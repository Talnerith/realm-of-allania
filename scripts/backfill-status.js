/**
 * One-time backfill: set status:'approved' on legacy threads/posts/codex_pages
 * that predate the moderation system (no status field). Required by the
 * security rules that restrict reads of unapproved content — legacy docs
 * without status can't be matched by status-filtered queries.
 *
 * Idempotent: only touches docs missing `status`.
 *
 * Usage (needs Google Application Default Credentials or
 * GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key):
 *   node scripts/backfill-status.js
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
    for (const coll of COLLECTIONS) {
        const snap = await db.collection(`artifacts/${APP_ID}/public/data/${coll}`).get();
        let updated = 0;
        let batch = db.batch();
        let ops = 0;

        for (const doc of snap.docs) {
            if (!('status' in doc.data())) {
                batch.update(doc.ref, {
                    status: 'approved',
                    statusBackfilledAt: admin.firestore.FieldValue.serverTimestamp()
                });
                ops++;
                updated++;
                if (ops >= 450) {
                    await batch.commit();
                    batch = db.batch();
                    ops = 0;
                }
            }
        }
        if (ops > 0) await batch.commit();
        console.log(`${coll}: ${snap.size} docs scanned, ${updated} backfilled`);
    }
    console.log('Backfill complete.');
    process.exit(0);
})().catch((e) => {
    console.error('Backfill failed:', e.message);
    process.exit(1);
});
