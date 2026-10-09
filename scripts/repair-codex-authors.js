/**
 * One-time repair: codex pages whose "Written by" shows "Unknown author".
 *
 * A codex page's author is the public profile of its creatorId. Older pages
 * (made before the codex stored creatorId, or carried over from an earlier
 * version) can lack it, so the page shows "Unknown author" and is missing
 * from its owner's "<Author>'s Characters" list. For pages linked to a
 * character (relatedId, set when a character's codex page is created from the
 * roster) the owner is the player whose characters/{relatedId} that is.
 *
 * Reports every page with no usable author and, with --write, sets creatorId
 * (and lastEditorId when it's missing) to the character's owner. Pages whose
 * creatorId is right but whose author has no profile are listed: run
 * scripts/backfill-profiles.js --write for those.
 *
 * Usage (needs GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key):
 *   node scripts/repair-codex-authors.js           # dry run
 *   node scripts/repair-codex-authors.js --write
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
    // Character id -> owner uid, from artifacts/{APP_ID}/users/{uid}/characters/{id}
    const owners = new Map();
    const chars = await db.collectionGroup('characters').get();
    chars.forEach((doc) => {
        const parts = doc.ref.path.split('/');
        if (parts[0] === 'artifacts' && parts[1] === APP_ID && parts[2] === 'users') owners.set(doc.id, { uid: parts[3], name: doc.get('name') });
    });

    const profiles = new Map();
    const hasProfile = async (uid) => {
        if (!profiles.has(uid)) {
            const snap = await db.doc(`artifacts/${APP_ID}/public/data/profiles/${uid}`).get();
            profiles.set(uid, snap.exists && !!snap.get('displayName'));
        }
        return profiles.get(uid);
    };

    const pages = await db.collection(`artifacts/${APP_ID}/public/data/codex_pages`).get();
    const fixes = [], noProfile = [], unknown = [];
    for (const doc of pages.docs) {
        const page = doc.data();
        const owner = page.relatedId ? owners.get(page.relatedId) : null;
        const label = `${doc.id} "${page.title}"`;
        if (owner && page.creatorId !== owner.uid) {
            fixes.push({ doc, owner, label: `${label}: creatorId ${page.creatorId || '(none)'} -> ${owner.uid} (owner of ${owner.name})` });
        } else if (!page.creatorId) {
            unknown.push(`${label}: no creatorId and no linked character${page.relatedId ? ` (relatedId ${page.relatedId} not found)` : ''}`);
        } else if (!(await hasProfile(page.creatorId))) {
            noProfile.push(`${label}: author ${page.creatorId} has no public profile`);
        }
    }

    if (WRITE) {
        const writer = db.bulkWriter();
        fixes.forEach(({ doc, owner }) => writer.update(doc.ref, {
            creatorId: owner.uid,
            ...(!doc.get('lastEditorId') && { lastEditorId: owner.uid })
        }));
        await writer.close();
    }

    console.log(`Checked ${pages.size} codex pages against ${owners.size} characters.`);
    console.log(`${WRITE ? 'Fixed' : 'Would fix'} ${fixes.length}:${fixes.map(f => `\n  ${f.label}`).join('')}`);
    if (noProfile.length) console.log(`Author without a profile (run backfill-profiles.js --write) ${noProfile.length}:\n  ${noProfile.join('\n  ')}`);
    if (unknown.length) console.log(`No author can be worked out for ${unknown.length} (fix by hand):\n  ${unknown.join('\n  ')}`);
    if (!WRITE) console.log('Dry run. Re-run with --write to apply.');
})().catch((e) => { console.error(e); process.exit(1); });
