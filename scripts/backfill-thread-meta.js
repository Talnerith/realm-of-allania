/**
 * One-time backfill: set the thread summary fields the region and thread
 * pages show (excerpt of the opening post, who replied last) on threads
 * created before the moderatePost function started keeping them. Threads made
 * before threads recorded their starter character (no characterId) get it
 * from their opening post by the same player, with that character's name, so
 * the header can show its portrait.
 *
 * Uses approved posts only, so nothing unmoderated becomes visible. Idempotent:
 * re-running recomputes the same values.
 *
 * Usage (needs GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key):
 *   node scripts/backfill-thread-meta.js           # dry run
 *   node scripts/backfill-thread-meta.js --write
 */
// firebase-admin lives in functions/node_modules, not at the repo root
const path = require('path');
const { createRequire } = require('module');
const fnRequire = createRequire(path.join(__dirname, '..', 'functions', 'index.js'));
const admin = fnRequire('firebase-admin');
const { plainExcerpt } = fnRequire('./threadMeta.js');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'realm-of-aethelraed';
const DATA = 'artifacts/realm-of-allania-v2/public/data';
const WRITE = process.argv.includes('--write');

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

(async () => {
    const threads = await db.collection(`${DATA}/threads`).get();
    let updated = 0, skipped = 0;
    for (const t of threads.docs) {
        const posts = await db.collection(`${DATA}/posts`)
            .where('threadId', '==', t.id).where('status', '==', 'approved')
            .orderBy('createdAt', 'asc').get();
        if (posts.empty) { skipped++; continue; }
        const first = posts.docs[0], last = posts.docs[posts.size - 1].data();
        const opening = first.data();
        const fields = {
            ...(!t.get('characterId') && opening.userId === t.get('creatorId') && opening.characterId && {
                characterId: opening.characterId,
                createdBy: opening.characterName || t.get('createdBy')
            }),
            excerpt: plainExcerpt(opening.content),
            openingPostId: first.id,
            lastPostBy: last.characterName || 'Unknown',
            lastPostCharacterId: last.characterId || null,
            lastPostUserId: last.userId || null,
            lastPostAt: last.createdAt || null
        };
        if (fields.characterId) console.log(`  ${t.get('title')}: starter character ${fields.createdBy}`);
        if (WRITE) await t.ref.update(fields);
        updated++;
    }
    console.log(`${WRITE ? 'Updated' : 'Would update'} ${updated} threads; ${skipped} have no approved posts.`);
    if (!WRITE) console.log('Dry run. Re-run with --write to apply.');
})().catch((e) => { console.error(e); process.exit(1); });
