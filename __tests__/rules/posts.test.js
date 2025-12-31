
const { assertFails, assertSucceeds, initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { setDoc, doc } = require('firebase/firestore');
const fs = require('fs');

const PROJECT_ID = 'realm-of-aethelraed-test';
const APP_ID = 'realm-of-allania-v2';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Setup user roles
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // Regular user
    await setDoc(doc(db, `artifacts/${APP_ID}/users/user1/settings/account`), { role: 'user' });

    // Trusted user
    await setDoc(doc(db, `artifacts/${APP_ID}/users/trusted1/settings/account`), { role: 'trusted' });

    // Moderator
    await setDoc(doc(db, `artifacts/${APP_ID}/users/mod1/settings/account`), { role: 'moderator' });
  });
});

describe('Firestore Rules: Posts', () => {
  const postData = {
    content: 'Valid content checks out.',
    threadId: 'thread1',
    userId: 'user1',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  test('User can create post with status "pending"', async () => {
    const userDb = testEnv.authenticatedContext('user1').firestore();
    await assertSucceeds(setDoc(doc(userDb, `artifacts/${APP_ID}/public/data/posts/post1`), postData));
  });

  test('User cannot create post with status "approved"', async () => {
    const userDb = testEnv.authenticatedContext('user1').firestore();
    await assertFails(setDoc(doc(userDb, `artifacts/${APP_ID}/public/data/posts/post2`), {
      ...postData,
      status: 'approved'
    }));
  });

  test('Trusted user can create post with status "approved"', async () => {
    const trustedDb = testEnv.authenticatedContext('trusted1').firestore();
    await assertSucceeds(setDoc(doc(trustedDb, `artifacts/${APP_ID}/public/data/posts/post3`), {
      ...postData,
      userId: 'trusted1',
      status: 'approved'
    }));
  });

  test('User cannot update status field', async () => {
    const userDb = testEnv.authenticatedContext('user1').firestore();
    // Create first
    await setDoc(doc(userDb, `artifacts/${APP_ID}/public/data/posts/post1`), postData);

    // Attempt update
    await assertFails(setDoc(doc(userDb, `artifacts/${APP_ID}/public/data/posts/post1`), {
      ...postData,
      status: 'approved'
    }));
  });

  test('Moderator can update status field', async () => {
    const modDb = testEnv.authenticatedContext('mod1').firestore();

    // Setup post by user
    await testEnv.withSecurityRulesDisabled(async (context) => {
       await setDoc(doc(context.firestore(), `artifacts/${APP_ID}/public/data/posts/post1`), postData);
    });

    // Mod updates status
    await assertSucceeds(setDoc(doc(modDb, `artifacts/${APP_ID}/public/data/posts/post1`), {
      ...postData,
      status: 'approved'
    }));
  });

  test('Content must be at least 10 chars', async () => {
    const userDb = testEnv.authenticatedContext('user1').firestore();
    await assertFails(setDoc(doc(userDb, `artifacts/${APP_ID}/public/data/posts/postShort`), {
      ...postData,
      content: 'Short'
    }));
  });

  test('Content must be at most 5000 chars', async () => {
    const userDb = testEnv.authenticatedContext('user1').firestore();
    const longContent = 'a'.repeat(5001);
    await assertFails(setDoc(doc(userDb, `artifacts/${APP_ID}/public/data/posts/postLong`), {
      ...postData,
      content: longContent
    }));
  });
});
