// Finds and deletes uploaded images that nothing on the site uses any more.
//
// Images replaced before saving (an upload swapped for another, a link import
// swapped for another) stay in Storage. An image counts as used when any
// Firestore document mentions its file name: portraits, banners, codex
// galleries, markdown images in posts and codex text, approved snapshots,
// author avatars, a rejected codex edit's proposedEdit. Moderation logs and
// notifications only record what happened to a file, so they don't keep it.
// Recent files are skipped (someone may be mid-edit), and so are legacy files
// outside a player's folder.
//
// Used by the weekly cleanupOrphanImages function and by
// scripts/cleanup-orphan-images.js (dry run / --write with a local backup).
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

const APP_ID = 'realm-of-allania-v2';
const SCHEDULED_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const PARALLEL = 20; // documents read at once while walking the database

// Collections that log what happened to a file rather than use it
const isLogOnly = (collectionPath) => /(^|\/)(moderation_logs|notifications)$/.test(collectionPath);
const isModerationLog = (collectionPath) => /(^|\/)moderation_logs$/.test(collectionPath);

// Every string in a value, also URI-decoded. Only arrays and plain maps are
// walked: Timestamps, references and the like hold no file names.
function collectStrings(value, out) {
    if (typeof value === 'string') {
        out.push(value);
        try { out.push(decodeURIComponent(value)); } catch { /* not URI-encoded */ }
    } else if (Array.isArray(value)) {
        value.forEach((v) => collectStrings(v, out));
    } else if (value && typeof value === 'object'
        && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
        Object.values(value).forEach((v) => collectStrings(v, out));
    }
}

async function inChunks(items, size, fn) {
    for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

// Every string in every document, walking subcollections (including under
// documents that only exist as parents of subcollections)
async function walk(collectionRef, out, counts) {
    const logOnly = isLogOnly(collectionRef.path);
    const keepProposedEdit = isModerationLog(collectionRef.path);
    const docRefs = await collectionRef.listDocuments();
    await inChunks(docRefs, PARALLEL, async (docRef) => {
        const [snap, subcollections] = await Promise.all([docRef.get(), docRef.listCollections()]);
        if (snap.exists) {
            counts.docs++;
            const data = snap.data();
            // A rejected codex edit's images stay until a moderator decides
            if (!logOnly) collectStrings(data, out);
            else if (keepProposedEdit) collectStrings(data.proposedEdit, out);
        }
        for (const sub of subcollections) await walk(sub, out, counts);
    });
}

/**
 * Lists the orphaned images: files under artifacts/<APP_ID>/public/<folder>/<uid>/
 * whose file name no Firestore document mentions, older than graceMs.
 * @returns {{ orphans: object[], orphanBytes: number, counts: object }}
 */
async function findOrphanImages({ db, bucket, now = Date.now(), graceMs }) {
    if (!(graceMs >= 0)) throw new Error('findOrphanImages needs a graceMs');
    const strings = [];
    const counts = { docs: 0, files: 0, used: 0, recent: 0, legacy: 0, otherPrefix: 0 };
    for (const col of await db.listCollections()) await walk(col, strings, counts);
    // An empty scan would make every image look unused
    if (counts.docs === 0) throw new Error('No Firestore documents found; refusing to treat every image as orphaned.');
    const haystack = strings.join('\n');

    const [files] = await bucket.getFiles();
    counts.files = files.length;
    const orphans = [];
    for (const file of files) {
        const parts = file.name.split('/');
        // artifacts/{APP_ID}/public/{folder}/{uid}/{filename}
        if (parts[0] !== 'artifacts' || parts[1] !== APP_ID || parts[2] !== 'public') { counts.otherPrefix++; continue; }
        if (parts.length !== 6 || !parts[5]) { counts.legacy++; continue; }
        if (haystack.includes(parts[5])) { counts.used++; continue; }
        if (now - new Date(file.metadata.timeCreated).getTime() < graceMs) { counts.recent++; continue; }
        orphans.push(file);
    }
    const orphanBytes = orphans.reduce((sum, f) => sum + Number(f.metadata.size || 0), 0);
    return { orphans, orphanBytes, counts };
}

const cleanupOrphanImages = onSchedule(
    { schedule: "every sunday 04:00", timeZone: "UTC", region: "us-central1", timeoutSeconds: 540, memory: "512MiB" },
    async () => {
        const { orphans, orphanBytes, counts } = await findOrphanImages({
            db: admin.firestore(),
            bucket: admin.storage().bucket(),
            graceMs: SCHEDULED_GRACE_MS
        });

        let deleted = 0;
        const failed = [];
        for (const file of orphans) {
            try {
                await file.delete();
                deleted++;
            } catch (error) {
                if (error.code === 404) continue; // already gone
                failed.push(file.name);
                console.error(`[Orphan Images] Could not delete ${file.name}:`, error.message);
            }
        }
        console.log(`[Orphan Images] Scanned ${counts.docs} documents and ${counts.files} files: ${counts.used} in use, ` +
            `${counts.recent} newer than 7 days, ${counts.legacy} legacy, ${counts.otherPrefix} outside ${APP_ID}/public. ` +
            `Deleted ${deleted} of ${orphans.length} orphans (${(orphanBytes / 1048576).toFixed(2)} MB), ${failed.length} failed.`);
        orphans.forEach((f) => console.log(`[Orphan Images]   ${f.name}`));
    }
);

module.exports = { findOrphanImages, cleanupOrphanImages, collectStrings, SCHEDULED_GRACE_MS };
