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

  test('a player may set their own author picture', async () => {
    await seed(profile('reader'), { displayName: 'Emberquill' });
    const url = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/avatar.jpg';
    await assertSucceeds(updateDoc(doc(dbFor('reader'), profile('reader')), { avatarUrl: url, avatarPosition: '50% 30%' }));
    await assertSucceeds(updateDoc(doc(dbFor('reader'), profile('reader')), { avatarUrl: '' }));
    await assertFails(updateDoc(doc(dbFor('author'), profile('reader')), { avatarUrl: url }));
    await assertFails(updateDoc(doc(dbFor('reader'), profile('reader')), { avatarUrl: 42 }));
    await assertFails(updateDoc(doc(dbFor('reader'), profile('reader')), { avatarUrl: 'x'.repeat(2049) }));
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

describe('Thread tags, views and server fields', () => {
  const THREAD = `${DATA}/threads/thread1`;
  const newThread = (extra = {}) => ({
    title: 'A New Tale', regionId: '12', creatorId: 'reader', status: 'pending',
    updatedAt: serverTimestamp(), postCount: 1, ...extra
  });

  beforeEach(async () => {
    await seed(THREAD, { title: 'A Grand Adventure', regionId: '12', creatorId: 'author', status: 'approved', postCount: 1, views: 4, tags: ['Lore'] });
    await seed(`${DATA}/threads/pendingT`, { title: 'Pending Tale', regionId: '12', creatorId: 'author', status: 'pending', postCount: 1 });
  });

  test('new threads take up to 3 tags from the list', async () => {
    await assertSucceeds(setDoc(doc(dbFor('reader'), `${DATA}/threads/n1`), newThread({ tags: ['Roleplay', 'Lore', 'Open'] })));
    await assertFails(setDoc(doc(dbFor('reader'), `${DATA}/threads/n2`), newThread({ tags: ['Roleplay', 'Lore', 'Open', 'Trade'] })));
    await assertFails(setDoc(doc(dbFor('reader'), `${DATA}/threads/n3`), newThread({ tags: ['Spam'] })));
  });

  test('clients cannot set excerpt, last reply or views', async () => {
    for (const extra of [{ excerpt: 'fake' }, { lastPostBy: 'Someone' }, { views: 999 }]) {
      await assertFails(setDoc(doc(dbFor('reader'), `${DATA}/threads/x${Object.keys(extra)[0]}`), newThread(extra)));
    }
    await assertFails(updateDoc(doc(dbFor('author'), THREAD), { excerpt: 'rewritten' }));
    await assertFails(updateDoc(doc(dbFor('mod1'), THREAD), { lastPostBy: 'Nobody' }));
  });

  test('the creator can retag within the list', async () => {
    await assertSucceeds(updateDoc(doc(dbFor('author'), THREAD), { tags: ['Adventure', 'Ongoing'] }));
    await assertFails(updateDoc(doc(dbFor('author'), THREAD), { tags: ['Nonsense'] }));
  });

  test('any signed-in player adds exactly one view to a published thread', async () => {
    await assertSucceeds(updateDoc(doc(dbFor('reader'), THREAD), { views: 5 }));
    await assertFails(updateDoc(doc(dbFor('reader'), THREAD), { views: 50 }));
    await assertFails(updateDoc(doc(dbFor('reader'), THREAD), { views: 5, title: 'Hijacked' }));
    await assertFails(updateDoc(doc(guest(), THREAD), { views: 5 }));
    await assertFails(updateDoc(doc(dbFor('banned1'), THREAD), { views: 5 }));
    await assertFails(updateDoc(doc(dbFor('author'), `${DATA}/threads/pendingT`), { views: 1 }));
  });
});

describe('Character reputation', () => {
  const CHAR = `${USERS}/reader/characters/c1`;
  beforeEach(async () => {
    await seed(`${USERS}/reader/settings/account`, { role: 'user', characterCount: 1 });
    await seed(CHAR, { name: 'Lyra', race: 'Elf', class: 'Ranger', likesReceived: 2 });
  });

  test('owners can edit their character but not its reputation', async () => {
    await assertSucceeds(updateDoc(doc(dbFor('reader'), CHAR), { description: 'A tracker.' }));
    await assertFails(updateDoc(doc(dbFor('reader'), CHAR), { likesReceived: 500 }));
  });
});

describe('Sealed threads', () => {
  beforeEach(async () => {
    await seed(`${DATA}/threads/sealed`, { title: 'The Oath', regionId: '12', creatorId: 'author', status: 'approved', postCount: 1, isLocked: true });
    await seed(`${USERS}/reader/characters/c1`, { name: 'Lyra', race: 'Elf', class: 'Ranger' });
  });
  const reply = (uid) => setDoc(doc(dbFor(uid), `${DATA}/posts/r-${uid}`), {
    content: 'A reply to the sealed oath.', threadId: 'sealed', userId: uid, status: uid === 'mod1' ? 'approved' : 'pending'
  });

  test('players cannot post in a sealed thread; moderators can', async () => {
    await assertFails(reply('reader'));
    await assertSucceeds(reply('mod1'));
  });
});

describe('Codex tags', () => {
  const page = (extra = {}) => ({
    title: 'Zekiel', content: 'A wanderer of the dunes.', gallery: [], creatorId: 'reader', lastEditorId: 'reader', status: 'pending', ...extra
  });

  test('pages take up to 3 short tags without blocked words', async () => {
    await assertSucceeds(setDoc(doc(dbFor('reader'), `${DATA}/codex_pages/c1`), page({ tags: ['Rogue', 'Deceased', 'Historical'] })));
    await assertFails(setDoc(doc(dbFor('reader'), `${DATA}/codex_pages/c2`), page({ tags: ['a', 'b', 'c', 'd'] })));
    await assertFails(setDoc(doc(dbFor('reader'), `${DATA}/codex_pages/c3`), page({ tags: ['x'.repeat(30)] })));
    await assertFails(setDoc(doc(dbFor('reader'), `${DATA}/codex_pages/c4`), page({ tags: ['free money'] })));
  });

  test('changing tags sends the page back to moderation', async () => {
    await seed(`${DATA}/codex_pages/c5`, page({ status: 'approved', tags: ['Rogue'] }));
    await assertFails(updateDoc(doc(dbFor('reader'), `${DATA}/codex_pages/c5`), { tags: ['Hero'], lastEditorId: 'reader' }));
    await assertSucceeds(updateDoc(doc(dbFor('reader'), `${DATA}/codex_pages/c5`), { tags: ['Hero'], lastEditorId: 'reader', status: 'pending' }));
  });
});
