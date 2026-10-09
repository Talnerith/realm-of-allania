// Storage rules: uploads go in the player's own folder, as raster images,
// from verified players who aren't banned. Needs the storage and firestore
// emulators (the rules read the player's role from Firestore).
const { assertFails, assertSucceeds, initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, setDoc } = require('firebase/firestore');
const { ref, uploadBytes, getMetadata, updateMetadata, deleteObject } = require('firebase/storage');
const fs = require('fs');

// Cross-service rules read the Firestore emulator under the emulator's own
// project (.firebaserc's default), so the test must use the same id
const PROJECT_ID = 'realm-of-aethelraed';
const APP_ID = 'realm-of-allania-v2';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let testEnv;

const storageFor = (uid, token = { email_verified: true }) => testEnv.authenticatedContext(uid, token).storage();
const upload = (uid, path, type = 'image/png', token) =>
  uploadBytes(ref(storageFor(uid, token), `artifacts/${APP_ID}/public/${path}`), PNG, { contentType: type });

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: { rules: fs.readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => { await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `artifacts/${APP_ID}/users/p1/settings/account`), { role: 'user' });
    await setDoc(doc(context.firestore(), `artifacts/${APP_ID}/users/exile/settings/account`), { role: 'banned' });
  });
});

describe('Held images', () => {
  const HELD_PATH = `artifacts/${APP_ID}/public/character_portraits/p1/held.png`;
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled((context) => uploadBytes(ref(context.storage(), HELD_PATH), PNG, {
      contentType: 'image/png', customMetadata: { moderation: 'held' }
    }));
  });

  test('nobody can read a held image (so no new download link can be made)', async () => {
    await assertFails(getMetadata(ref(storageFor('p1'), HELD_PATH)));
    await assertFails(getMetadata(ref(storageFor('p2'), HELD_PATH)));
    await assertFails(getMetadata(ref(testEnv.unauthenticatedContext().storage(), HELD_PATH)));
  });

  test('the owner cannot remove the mark or replace the held file', async () => {
    await assertFails(updateMetadata(ref(storageFor('p1'), HELD_PATH), { customMetadata: { moderation: '' } }));
    await assertFails(upload('p1', 'character_portraits/p1/held.png'));
  });

  test('the owner can still delete it', async () => {
    await assertSucceeds(deleteObject(ref(storageFor('p1'), HELD_PATH)));
  });

  test('uploads cannot mark themselves held', async () => {
    await assertFails(uploadBytes(ref(storageFor('p1'), `artifacts/${APP_ID}/public/character_portraits/p1/self.png`), PNG, {
      contentType: 'image/png', customMetadata: { moderation: 'held' }
    }));
  });

  test('ordinary images stay readable', async () => {
    await assertSucceeds(upload('p1', 'character_portraits/p1/ok.png'));
    await assertSucceeds(getMetadata(ref(storageFor('p2'), `artifacts/${APP_ID}/public/character_portraits/p1/ok.png`)));
  });
});

describe('Uploads', () => {
  test('a player uploads an image to their own folder', async () => {
    await assertSucceeds(upload('p1', 'character_portraits/p1/a.png'));
  });

  test('a player without an account doc can still upload', async () => {
    await assertSucceeds(upload('newcomer', 'character_portraits/newcomer/a.png'));
  });

  test('banned players cannot upload', async () => {
    await assertFails(upload('exile', 'character_portraits/exile/a.png'));
  });

  test('not into someone else\'s folder, not unverified, not SVG', async () => {
    await assertFails(upload('p1', 'character_portraits/p2/a.png'));
    await assertFails(upload('p1', 'character_portraits/p1/a.png', 'image/png', { email_verified: false }));
    await assertFails(upload('p1', 'character_portraits/p1/a.svg', 'image/svg+xml'));
  });
});
