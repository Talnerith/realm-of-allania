/**
 * One-time backfill: create the public profile (author display name) of every
 * existing player, from their Firebase Auth display name (the username they
 * chose at registration). New players get one at signup, and anyone who signs
 * in gets one automatically, so this only covers players who haven't been
 * back since. It also makes the Landing "Members" count complete.
 *
 * Idempotent: never overwrites an existing profile. Names outside 2-30
 * characters are skipped and listed.
 *
 * Usage (needs Google Application Default Credentials or
 * GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key):
 *   node scripts/backfill-profiles.js           # dry run
 *   node scripts/backfill-profiles.js --write
 */
// firebase-admin lives in functions/node_modules, not at the repo root
const path = require('path');
const { createRequire } = require('module');
const fnRequire = createRequire(path.join(__dirname, '..', 'functions', 'index.js'));
const admin = fnRequire('firebase-admin');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'realm-of-aethelraed';
const APP_ID = 'realm-of-allania-v2';
const WRITE = process.argv.includes('--write');

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

(async () => {
    let created = 0, existing = 0;
    const skipped = [];
    let pageToken;
    do {
        const page = await admin.auth().listUsers(1000, pageToken);
        for (const user of page.users) {
            const ref = db.doc(`artifacts/${APP_ID}/public/data/profiles/${user.uid}`);
            const snap = await ref.get();
            if (snap.exists && snap.data().displayName) { existing++; continue; }
            const name = (user.displayName || '').trim();
            if (name.length < 2 || name.length > 30) { skipped.push(`${user.uid} (${JSON.stringify(name)})`); continue; }
            if (WRITE) {
                await ref.set({
                    displayName: name,
                    createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime) : admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
            created++;
        }
        pageToken = page.pageToken;
    } while (pageToken);

    console.log(`${WRITE ? 'Created' : 'Would create'} ${created} profiles; ${existing} already existed.`);
    if (skipped.length) console.log(`Skipped ${skipped.length} without a usable name:\n  ${skipped.join('\n  ')}`);
    if (!WRITE) console.log('Dry run. Re-run with --write to apply.');
})().catch((e) => { console.error(e); process.exit(1); });
