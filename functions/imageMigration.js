// One-time (re-runnable) admin tool: finds images that still point at outside
// hosts (pasted before pasted links were imported) and copies them into
// Storage, then rewrites every reference. The site only displays
// Storage-hosted images, so these were hidden until migrated. Imported files
// go through moderateImage like any upload.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { fetchImage, storeImage } = require('./importImage');

const APP_ID = 'realm-of-allania-v2';
const DATA = `artifacts/${APP_ID}/public/data`;
const MD_IMAGE = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;

function isExternalImageUrl(url, bucketName) {
    return typeof url === 'string'
        && /^https?:\/\//i.test(url)
        && !url.startsWith(`https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/`);
}

const markdownImageUrls = (text) =>
    typeof text === 'string' ? [...text.matchAll(MD_IMAGE)].map((m) => m[1]) : [];

// Every external image reference in the scanned documents.
// docs: [{ path, kind: 'thread'|'region'|'character'|'codex'|'post', owner, data }]
function findExternalImages(docs, bucketName) {
    const refs = [];
    for (const doc of docs) {
        const d = doc.data;
        const add = (field, url, folder) => {
            if (isExternalImageUrl(url, bucketName)) refs.push({ path: doc.path, field, url, folder, owner: doc.owner });
        };
        const codexFields = (prefix, src) => {
            if (!src) return;
            add(`${prefix}imageUrl`, src.imageUrl, 'codex_gallery');
            (Array.isArray(src.gallery) ? src.gallery : []).forEach((u) => add(`${prefix}gallery`, u, 'codex_gallery'));
            markdownImageUrls(src.content).forEach((u) => add(`${prefix}content`, u, 'uploads'));
        };
        switch (doc.kind) {
            case 'thread': add('bannerUrl', d.bannerUrl, 'thread_banners'); break;
            case 'region': add('bannerUrl', d.bannerUrl, 'region_banners'); break;
            case 'character': add('imageUrl', d.imageUrl, 'character_portraits'); break;
            case 'codex':
                codexFields('', d);
                codexFields('approvedSnapshot.', d.approvedSnapshot);
                break;
            case 'post':
                add('characterImageUrl', d.characterImageUrl, 'character_portraits');
                markdownImageUrls(d.content).forEach((u) => add('content', u, 'uploads'));
                break;
        }
    }
    return refs;
}

// The Firestore update for one document: each listed field with imported
// URLs swapped in. Fields whose images all failed to import are left out.
function rewriteFields(data, fields, mapping) {
    const swap = (u) => (mapping.has(u) ? mapping.get(u) : u);
    const swapText = (t) => t.replace(MD_IMAGE, (m, u) => (mapping.has(u) ? m.replace(u, mapping.get(u)) : m));
    const get = (path) => path.split('.').reduce((o, k) => o?.[k], data);
    const update = {};
    for (const field of new Set(fields)) {
        const value = get(field);
        const leaf = field.split('.').pop();
        const next = leaf === 'gallery' ? value.map(swap) : leaf === 'content' ? swapText(value) : swap(value);
        if (JSON.stringify(next) !== JSON.stringify(value)) update[field] = next;
    }
    return update;
}

async function scanDocuments(db, adminUid) {
    const [threads, regions, codex, posts, characters] = await Promise.all([
        db.collection(`${DATA}/threads`).get(),
        db.collection(`${DATA}/region_metadata`).get(),
        db.collection(`${DATA}/codex_pages`).get(),
        db.collection(`${DATA}/posts`).get(),
        db.collectionGroup('characters').get()
    ]);
    const docs = [];
    const push = (snap, kind, owner) => snap.forEach((d) => docs.push({ path: d.ref.path, kind, owner: owner(d), data: d.data() }));
    push(threads, 'thread', (d) => d.get('creatorId') || adminUid);
    push(regions, 'region', () => adminUid);
    push(codex, 'codex', (d) => d.get('creatorId') || adminUid);
    push(posts, 'post', (d) => d.get('userId') || adminUid);
    characters.forEach((d) => {
        const parts = d.ref.path.split('/'); // artifacts/<app>/users/<uid>/characters/<id>
        if (parts[1] === APP_ID && parts[2] === 'users') docs.push({ path: d.ref.path, kind: 'character', owner: parts[3], data: d.data() });
    });
    return docs;
}

const migrateExternalImages = onCall(
    { region: "us-central1", timeoutSeconds: 540, memory: "512MiB" },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
        const db = admin.firestore();
        const account = await db.doc(`artifacts/${APP_ID}/users/${request.auth.uid}/settings/account`).get();
        if (!account.exists || account.data().role !== 'admin') {
            throw new HttpsError('permission-denied', 'Only admins can migrate images.');
        }
        const dryRun = request.data?.dryRun !== false;
        const bucketName = admin.storage().bucket().name;

        const docs = await scanDocuments(db, request.auth.uid);
        const refs = findExternalImages(docs, bucketName);

        // One import per distinct URL, owned by the first document that uses it
        const images = new Map();
        for (const ref of refs) {
            const img = images.get(ref.url) ?? { url: ref.url, folder: ref.folder, owner: ref.owner, uses: 0, places: new Set() };
            img.uses += 1;
            img.places.add(ref.path.split('/').slice(-2, -1)[0]);
            images.set(ref.url, img);
        }
        const summary = [...images.values()].map(({ url, uses, places }) => ({ url, uses, places: [...places] }));
        if (dryRun) return { dryRun: true, images: summary };

        const mapping = new Map();
        const failed = [];
        for (const img of images.values()) {
            try {
                mapping.set(img.url, await storeImage(await fetchImage(img.url), img.folder, img.owner));
            } catch (error) {
                failed.push({ url: img.url, error: error.message });
            }
        }

        const byPath = new Map();
        for (const ref of refs) byPath.set(ref.path, [...(byPath.get(ref.path) ?? []), ref.field]);
        const dataByPath = new Map(docs.map((d) => [d.path, d.data]));
        const writer = db.bulkWriter();
        let documentsUpdated = 0;
        for (const [path, fields] of byPath) {
            const update = rewriteFields(dataByPath.get(path), fields, mapping);
            if (Object.keys(update).length) {
                writer.update(db.doc(path), update);
                documentsUpdated += 1;
            }
        }
        await writer.close();

        console.log(`[Image Migration] ${request.auth.uid}: ${mapping.size} imported, ${failed.length} failed, ${documentsUpdated} documents updated`);
        return { dryRun: false, imported: mapping.size, failed, documentsUpdated };
    }
);

module.exports = { migrateExternalImages, findExternalImages, rewriteFields, isExternalImageUrl };
