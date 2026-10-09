// Storage rules: uploads go in the player's own folder, as raster images,
// from verified players who aren't banned. Needs the storage and firestore
// emulators (the rules read the player's role from Firestore).
const { assertFails, assertSucceeds, initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, setDoc } = require('firebase/firestore');
const { ref, uploadBytes } = require('firebase/storage');
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
