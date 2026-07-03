/**
 * READ-ONLY: counts docs in threads/posts/codex_pages missing a `status`
 * field, to determine whether scripts/backfill-status.js needs to run before
 * deploying the read-restriction security rules. Writes nothing.
 *
 * Usage: node scripts/count-legacy-status.js
 */
// firebase-admin lives in functions/node_modules, not at the repo root
const path = require('path');
const { createRequire } = require('module');
const fnRequire = createRequire(path.join(__dirname, '..', 'functions', 'index.js'));
const admin = fnRequire('firebase-admin');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'realm-of-aethelraed';
const APP_ID = 'realm-of-allania-v2';
const COLLECTIONS = ['threads', 'posts', 'codex_pages'];

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

(async () => {
    let totalLegacy = 0;
    for (const coll of COLLECTIONS) {
        const snap = await db.collection(`artifacts/${APP_ID}/public/data/${coll}`).get();
        const legacy = snap.docs.filter((d) => !('status' in d.data())).length;
        totalLegacy += legacy;
        console.log(`${coll}: ${snap.size} docs, ${legacy} missing status`);
    }
    console.log(`TOTAL legacy docs needing backfill: ${totalLegacy}`);
    process.exit(0);
})().catch((e) => {
    console.error('Count failed:', e.message);
    process.exit(1);
});
