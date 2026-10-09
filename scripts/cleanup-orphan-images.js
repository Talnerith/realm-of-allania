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
 * The scan is shared with the weekly cleanupOrphanImages Cloud Function
 * (functions/orphanImages.js), which deletes orphans older than 7 days.
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
const { findOrphanImages } = fnRequire('./orphanImages');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'realm-of-aethelraed';
const BUCKET = process.env.STORAGE_BUCKET || `${PROJECT_ID}.firebasestorage.app`;
const APP_ID = 'realm-of-allania-v2';
const WRITE = process.argv.includes('--write');
const backupArg = process.argv.indexOf('--backup');
const BACKUP_DIR = backupArg > -1 ? process.argv[backupArg + 1] : path.join(process.cwd(), `orphan-images-backup-${new Date().toISOString().slice(0, 10)}`);
const GRACE_MS = 24 * 60 * 60 * 1000;

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

(async () => {
    const { orphans, orphanBytes, counts } = await findOrphanImages({
        db,
        bucket: admin.storage().bucket(BUCKET),
        graceMs: GRACE_MS
    });
    console.log(`Scanned ${counts.docs} documents.`);

    const mb = (bytes) => (bytes / 1048576).toFixed(2);
    console.log(`${counts.files} files: ${counts.used} in use, ${orphans.length} orphaned (${mb(orphanBytes)} MB), ${counts.recent} too recent to judge, ${counts.legacy} legacy, ${counts.otherPrefix} outside ${APP_ID}/public.`);
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
