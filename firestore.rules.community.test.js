const { assertFails, assertSucceeds, initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { setDoc, doc, updateDoc, deleteDoc, getDoc, serverTimestamp } = require('firebase/firestore');
const fs = require('fs');

const PROJECT_ID = 'realm-of-aethelraed-test';
const APP_ID = 'realm-of-allania-v2';
const USERS = `artifacts/${APP_ID}/users`;
const DATA = `artifacts/${APP_ID}/public/data`;

let testEnv;

const dbFor = (uid, token = { email_verified: true }) => testEnv.authenticatedContext(uid, token).firestore();
const guest = () => testEnv.unauthenticatedContext().firestore();
const seed = (path, data) => testEnv.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), path), data));

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => { await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(`${USERS}/author/settings/account`, { role: 'user' });
  await seed(`${USERS}/reader/settings/account`, { role: 'user' });
  await seed(`${USERS}/banned1/settings/account`, { role: 'banned' });
  await seed(`${USERS}/mod1/settings/account`, { role: 'moderator' });
  await seed(`${DATA}/posts/post1`, { content: 'An approved post here.', threadId: 't1', userId: 'author', status: 'approved', likeCount: 2 });
  await seed(`${DATA}/posts/pending1`, { content: 'A pending post here.', threadId: 't1', userId: 'author', status: 'pending' });
});

const like = (uid, postId = 'post1', liker = uid) => setDoc(doc(dbFor(uid), `${DATA}/posts/${postId}/likes/${liker}`), { createdAt: serverTimestamp() });

describe('Likes', () => {
  test('a player can like someone else\'s approved post', async () => {
    await assertSucceeds(like('reader'));
  });

  test('anyone can read likes', async () => {
    await seed(`${DATA}/posts/post1/likes/reader`, { createdAt: new Date() });
    await assertSucceeds(getDoc(doc(guest(), `${DATA}/posts/post1/likes/reader`)));
  });

  test('nobody can like their own post', async () => {
    await assertFails(like('author'));
  });

  test('only one like per player: the like id must be their own uid', async () => {
    await assertFails(like('reader', 'post1', 'someone-else'));
  });

  test('a second like is an update, which is denied', async () => {
    await seed(`${DATA}/posts/post1/likes/reader`, { createdAt: new Date() });
    await assertFails(like('reader'));
  });

  test('unpublished, missing and unverified cases are denied', async () => {
    await assertFails(like('reader', 'pending1'));
    await assertFails(like('reader', 'nope'));
    await assertFails(setDoc(doc(dbFor('reader', { email_verified: false }), `${DATA}/posts/post1/likes/reader`), { createdAt: serverTimestamp() }));
    await assertFails(like('banned1'));
  });

  test('likes carry only a server timestamp', async () => {
    await assertFails(setDoc(doc(dbFor('reader'), `${DATA}/posts/post1/likes/reader`), { createdAt: serverTimestamp(), weight: 100 }));
    await assertFails(setDoc(doc(dbFor('reader'), `${DATA}/posts/post1/likes/reader`), { createdAt: new Date(Date.now() + 1e9) }));
  });

  test('a player can remove only their own like', async () => {
    await seed(`${DATA}/posts/post1/likes/reader`, { createdAt: new Date() });
    await assertFails(deleteDoc(doc(dbFor('author'), `${DATA}/posts/post1/likes/reader`)));
    await assertSucceeds(deleteDoc(doc(dbFor('reader'), `${DATA}/posts/post1/likes/reader`)));
  });

  test('the like counter cannot be set by clients', async () => {
    await assertFails(updateDoc(doc(dbFor('author'), `${DATA}/posts/post1`), { likeCount: 999 }));
    await assertFails(setDoc(doc(dbFor('reader'), `${DATA}/posts/new1`), {
      content: 'A brand new post.', threadId: 't1', userId: 'reader', status: 'pending', likeCount: 50
    }));
  });
});

describe('Public profiles', () => {
  const profile = (uid) => `${DATA}/profiles/${uid}`;

  test('a new player creates their profile at registration (before verifying email)', async () => {
    await assertSucceeds(setDoc(doc(dbFor('reader', { email_verified: false }), profile('reader')), { displayName: 'Emberquill', createdAt: serverTimestamp() }));
  });

  test('profiles are public', async () => {
    await seed(profile('reader'), { displayName: 'Emberquill' });
    await assertSucceeds(getDoc(doc(guest(), profile('reader'))));
  });

  test('only for yourself, with a valid name and no extra fields', async () => {
    await assertFails(setDoc(doc(dbFor('author'), profile('reader')), { displayName: 'Emberquill', createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(dbFor('reader'), profile('reader')), { displayName: 'X', createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(dbFor('reader'), profile('reader')), { displayName: 'Official Moderator', createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(dbFor('reader'), profile('reader')), { displayName: 'Emberquill', createdAt: serverTimestamp(), likesReceived: 1000 }));
    await assertFails(setDoc(doc(dbFor('banned1'), profile('banned1')), { displayName: 'Emberquill', createdAt: serverTimestamp() }));
  });

  test('a player may rename themselves but not touch their reputation', async () => {
    await seed(profile('reader'), { displayName: 'Emberquill', likesReceived: 3 });
    await assertSucceeds(updateDoc(doc(dbFor('reader'), profile('reader')), { displayName: 'Emberwing' }));
    await assertFails(updateDoc(doc(dbFor('reader'), profile('reader')), { likesReceived: 99 }));
  });
});

describe('Site stats', () => {
  test('anyone can read them, nobody can write them', async () => {
    await seed(`${DATA}/stats/site`, { members: 10 });
    await assertSucceeds(getDoc(doc(guest(), `${DATA}/stats/site`)));
    await assertFails(setDoc(doc(dbFor('mod1'), `${DATA}/stats/site`), { members: 1e6 }));
  });
});

describe('Account settings', () => {
  const account = (uid) => doc(dbFor(uid), `${USERS}/${uid}/settings/account`);

  test('players save their welcome choice and active character', async () => {
    await assertSucceeds(updateDoc(account('reader'), { hideWelcome: true }));
    await assertSucceeds(updateDoc(account('reader'), { activeCharId: 'char1' }));
    await assertSucceeds(updateDoc(account('reader'), { activeCharId: null }));
  });

  test('with the right types', async () => {
    await assertFails(updateDoc(account('reader'), { hideWelcome: 'yes' }));
    await assertFails(updateDoc(account('reader'), { activeCharId: 42 }));
    await assertFails(updateDoc(account('reader'), { activeCharId: 'x'.repeat(200) }));
  });
});
