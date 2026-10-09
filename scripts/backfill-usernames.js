/**
 * One-time backfill: claims every existing author name.
 *
 * Author names are unique (ignoring case and runs of spaces): each is claimed
 * by public/data/usernames/{nameKey(name)} = { uid }, written with the profile
 * from now on. Profiles made before that have no claim, so a new player could
 * take their name. This creates the missing claims.
 *
 * Two existing profiles with the same key are listed and neither is claimed:
 * one of them has to be renamed first (the other then gets the claim on the
 * next run).
 *
 * Usage (needs GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key):
 *   node scripts/backfill-usernames.js           # dry run
 *   node scripts/backfill-usernames.js --write
 */
// firebase-admin lives in functions/node_modules, not at the repo root
const path = require('path');
const { createRequire } = require('module');
const fnRequire = createRequire(path.join(__dirname, '..', 'functions', 'index.js'));
const admin = fnRequire('firebase-admin');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'realm-of-aethelraed';
const APP_ID = 'realm-of-allania-v2';
const WRITE = process.argv.includes('--write');

// Same key as nameKey() in src/lib/profiles.js and firestore.rules
const nameKey = (name) => 'n_' + String(name).toLowerCase().replace(/[ \t]+/g, ' ').replace(/\//g, '_');

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

(async () => {
    const data = db.collection('artifacts').doc(APP_ID).collection('public').doc('data');
    const [profiles, claims] = await Promise.all([data.collection('profiles').get(), data.collection('usernames').get()]);

    const claimed = new Map(claims.docs.map((d) => [d.id, d.get('uid')]));
    const byKey = new Map();
    profiles.forEach((p) => {
        const name = p.get('displayName');
        if (typeof name !== 'string' || !name) return;
        const key = nameKey(name);
        byKey.set(key, [...(byKey.get(key) || []), { uid: p.id, name }]);
    });

    const toClaim = [];
    let ok = 0;
    for (const [key, owners] of byKey) {
        if (owners.length > 1) {
            console.log(`DUPLICATE ${key}: ${owners.map((o) => `"${o.name}" (${o.uid})`).join(', ')} — rename all but one`);
            continue;
        }
        const [{ uid, name }] = owners;
        if (claimed.get(key) === uid) { ok++; continue; }
        if (claimed.has(key)) { console.log(`CONFLICT ${key}: claimed by ${claimed.get(key)}, but "${name}" (${uid}) uses it`); continue; }
        toClaim.push({ key, uid, name });
    }

    console.log(`${profiles.size} profiles: ${ok} already claimed, ${toClaim.length} to claim.`);
    toClaim.forEach((c) => console.log(`  ${c.key} -> "${c.name}" (${c.uid})`));
    if (!WRITE) {
        if (toClaim.length) console.log('\nDry run. Re-run with --write to create the claims.');
        return;
    }
    const writer = db.bulkWriter();
    // create() fails if a claim appeared meanwhile, rather than overwriting it
    toClaim.forEach((c) => writer.create(data.collection('usernames').doc(c.key), { uid: c.uid }));
    await writer.close();
    console.log(`\nCreated ${toClaim.length} claims.`);
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
