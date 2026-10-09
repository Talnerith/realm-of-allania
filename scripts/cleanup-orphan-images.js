/**
 * Deletes uploaded images that nothing on the site uses any more.
 *
 * Images replaced before saving (an upload swapped for another, a link
 * import swapped for another) used to stay in Storage. An image counts as
 * used when any Firestore document mentions its file name: portraits,
 * banners, codex galleries, markdown images in posts and codex text,
 * approved snapshots, author avatars, a rejected codex edit's proposedEdit.
 * Moderation logs and notifications only record what happened to a file,
 * so they don't keep it. Files in the last 24 hours are skipped (someone may
 * be mid-edit), and so are legacy files outside a player's folder.
 *
 * With --write every orphan is first downloaded to the backup folder (same
 * paths as in the bucket), then deleted.
 *
 * Usage (needs GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key):
 *   node scripts/cleanup-orphan-images.js                          # dry run
 *   node scripts/cleanup-orphan-images.js --write [--backup <dir>]
 */
// firebase-admin lives in functions/node_modules, not at the repo root
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const fnRequire = createRequire(path.join(__dirname, '..', 'functions', 'index.js'));
const admin = fnRequire('firebase-admin');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'realm-of-aethelraed';
const BUCKET = process.env.STORAGE_BUCKET || `${PROJECT_ID}.firebasestorage.app`;
const APP_ID = 'realm-of-allania-v2';
const WRITE = process.argv.includes('--write');
const backupArg = process.argv.indexOf('--backup');
const BACKUP_DIR = backupArg > -1 ? process.argv[backupArg + 1] : path.join(process.cwd(), `orphan-images-backup-${new Date().toISOString().slice(0, 10)}`);
const GRACE_MS = 24 * 60 * 60 * 1000;

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

// Collections that log what happened to a file rather than use it
const isLogOnly = (collectionPath) => /(^|\/)(moderation_logs|notifications)$/.test(collectionPath);

function collectStrings(value, out) {
    if (typeof value === 'string') {
        out.push(value);
        try { out.push(decodeURIComponent(value)); } catch { /* not URI-encoded */ }
    } else if (Array.isArray(value)) {
        value.forEach((v) => collectStrings(v, out));
    } else if (value && typeof value === 'object' && !(value instanceof admin.firestore.Timestamp)) {
        Object.values(value).forEach((v) => collectStrings(v, out));
    }
}

// Every string in every document, walking subcollections (including under
// documents that only exist as parents of subcollections)
async function walk(collectionRef, out, counts) {
    const logOnly = isLogOnly(collectionRef.path);
    const docRefs = await collectionRef.listDocuments();
    for (const docRef of docRefs) {
        const snap = await docRef.get();
        if (snap.exists) {
            counts.docs++;
            const data = snap.data();
            collectStrings(logOnly ? { proposedEdit: data.proposedEdit } : data, out);
        }
        for (const sub of await docRef.listCollections()) await walk(sub, out, counts);
    }
}

(async () => {
    const strings = [];
    const counts = { docs: 0 };
    for (const col of await db.listCollections()) await walk(col, strings, counts);
    const haystack = strings.join('\n');
    console.log(`Scanned ${counts.docs} documents.`);

    const [files] = await admin.storage().bucket(BUCKET).getFiles();
    const now = Date.now();
    const orphans = [];
    let used = 0, recent = 0, legacy = 0, otherPrefix = 0;
    for (const file of files) {
        const parts = file.name.split('/');
        // artifacts/{APP_ID}/public/{folder}/{uid}/{filename}
        if (parts[0] !== 'artifacts' || parts[1] !== APP_ID || parts[2] !== 'public') { otherPrefix++; continue; }
        if (parts.length !== 6) { legacy++; continue; }
        const basename = parts[5];
        if (haystack.includes(basename)) { used++; continue; }
        if (now - new Date(file.metadata.timeCreated).getTime() < GRACE_MS) { recent++; continue; }
        orphans.push(file);
    }

    const mb = (bytes) => (bytes / 1048576).toFixed(2);
    const orphanBytes = orphans.reduce((sum, f) => sum + Number(f.metadata.size), 0);
    console.log(`${files.length} files: ${used} in use, ${orphans.length} orphaned (${mb(orphanBytes)} MB), ${recent} too recent to judge, ${legacy} legacy, ${otherPrefix} outside ${APP_ID}/public.`);
    orphans.forEach((f) => console.log(`  ${f.name}  ${mb(Number(f.metadata.size))} MB  ${f.metadata.timeCreated}`));

    if (!WRITE) {
        if (orphans.length) console.log('\nDry run. Re-run with --write to back up and delete them.');
        return;
    }
    for (const file of orphans) {
        const dest = path.join(BACKUP_DIR, ...file.name.split('/'));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        await file.download({ destination: dest });
        await file.delete();
    }
    console.log(`\nBacked up to ${BACKUP_DIR} and deleted ${orphans.length} files.`);
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
