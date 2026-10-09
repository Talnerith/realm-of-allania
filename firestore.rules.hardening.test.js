// Rules added after the October 2026 security review: each test is one of the
// writes the review showed a player could make directly with the SDK.
const { assertFails, assertSucceeds, initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const {
  setDoc, doc, updateDoc, deleteDoc, writeBatch, collection, serverTimestamp, increment, Timestamp
} = require('firebase/firestore');
const fs = require('fs');

const PROJECT_ID = 'realm-of-aethelraed-test';
const APP_ID = 'realm-of-allania-v2';
const USERS = `artifacts/${APP_ID}/users`;
const DATA = `artifacts/${APP_ID}/public/data`;
const HOSTED = 'https://firebasestorage.googleapis.com/v0/b/realm-of-aethelraed.firebasestorage.app/o/artifacts%2Fp.jpg?alt=media';
const DOT_SEGMENTS = 'https://firebasestorage.googleapis.com/v0/b/realm-of-aethelraed.firebasestorage.app/o/../../evil.appspot.com/o/x.png?alt=media';

let testEnv;

const dbFor = (uid, token = { email_verified: true }) => testEnv.authenticatedContext(uid, token).firestore();
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
  await seed(`${USERS}/p1/settings/account`, { role: 'user', characterCount: 1 });
  await seed(`${USERS}/p2/settings/account`, { role: 'user', characterCount: 1 });
  await seed(`${USERS}/mod1/settings/account`, { role: 'moderator' });
  await seed(`${USERS}/p1/characters/c1`, { name: 'Aldric', race: 'Human', class: 'Knight', imageUrl: HOSTED });
  await seed(`${USERS}/p2/characters/c2`, { name: 'Brynn', race: 'Elf', class: 'Ranger' });
  await seed(`${DATA}/threads/t1`, { title: 'An Open Road', regionId: '12', creatorId: 'p2', status: 'approved', postCount: 1 });
});

const post = (extra = {}) => ({
  content: 'The road bends north here.', threadId: 't1', userId: 'p1', status: 'pending',
  createdAt: serverTimestamp(), characterId: 'c1', characterName: 'Aldric',
  characterRace: 'Human', characterClass: 'Knight', characterImageUrl: HOSTED, ...extra
});

describe('Posts', () => {
  test('carry the character as it is: race, class and portrait included', async () => {
    const db = dbFor('p1');
    await assertSucceeds(setDoc(doc(db, `${DATA}/posts/ok`), post()));
    await assertFails(setDoc(doc(db, `${DATA}/posts/race`), post({ characterRace: 'buy my stuff at example.com' })));
    await assertFails(setDoc(doc(db, `${DATA}/posts/class`), post({ characterClass: 'x'.repeat(5000) })));
    await assertFails(setDoc(doc(db, `${DATA}/posts/img`), post({ characterImageUrl: DOT_SEGMENTS })));
    // No character, no character fields
    await assertFails(setDoc(doc(db, `${DATA}/posts/bare`), {
      content: 'A post with no character.', threadId: 't1', userId: 'p1', status: 'pending', createdAt: serverTimestamp(), characterRace: 'Ad'
    }));
  });

  test('are dated by the server, not the writer', async () => {
    await assertFails(setDoc(doc(dbFor('p1'), `${DATA}/posts/future`), post({ createdAt: Timestamp.fromDate(new Date('2100-01-01')) })));
    await assertFails(setDoc(doc(dbFor('p1'), `${DATA}/posts/past`), post({ createdAt: Timestamp.fromDate(new Date('2000-01-01')) })));
  });

  test('a rejected post returns to moderation only with new content', async () => {
    await seed(`${DATA}/posts/r1`, { ...post(), createdAt: Timestamp.now(), status: 'rejected' });
    const ref = doc(dbFor('p1'), `${DATA}/posts/r1`);
    await assertFails(updateDoc(ref, { status: 'pending' }));
    await assertSucceeds(updateDoc(ref, { status: 'pending', content: 'A gentler telling of the road.' }));
  });
});

describe('Thread bumps', () => {
  const replyBatch = (db, threadId = 't1') => {
    const batch = writeBatch(db);
    const postRef = doc(collection(db, `${DATA}/posts`));
    batch.set(postRef, post({ threadId }));
    batch.update(doc(db, `${DATA}/threads/${threadId}`), { postCount: increment(1), updatedAt: serverTimestamp(), lastReplyPostId: postRef.id });
    return batch;
  };

  test('need the writer\'s own new post in the same thread', async () => {
    await seed(`${DATA}/posts/old`, { ...post(), createdAt: Timestamp.now() });
    await seed(`${DATA}/posts/theirs`, { ...post(), userId: 'p2', createdAt: Timestamp.now() });
    const ref = doc(dbFor('p1'), `${DATA}/threads/t1`);
    await assertFails(updateDoc(ref, { postCount: increment(1), updatedAt: serverTimestamp(), lastReplyPostId: 'old' }));
    await assertFails(updateDoc(ref, { postCount: increment(1), updatedAt: serverTimestamp(), lastReplyPostId: 'theirs' }));
    await assertSucceeds(replyBatch(dbFor('p1')).commit());
  });

  test('sealed threads take no bumps from players', async () => {
    await seed(`${DATA}/threads/sealed`, { title: 'The Oath', regionId: '12', creatorId: 'p2', status: 'approved', postCount: 1, isLocked: true });
    await assertFails(replyBatch(dbFor('p1'), 'sealed').commit());
  });
});

describe('Character cap', () => {
  const account = (uid) => doc(dbFor(uid), `${USERS}/${uid}/settings/account`);

  test('the count only goes down with a character deleted in the same batch', async () => {
    await assertFails(updateDoc(account('p1'), { characterCount: increment(-1) }));
    await assertFails(updateDoc(account('p1'), { characterCount: increment(-1), lastDeletedCharId: 'c1' }));
    const db = dbFor('p1');
    const batch = writeBatch(db);
    batch.delete(doc(db, `${USERS}/p1/characters/c1`));
    batch.update(doc(db, `${USERS}/p1/settings/account`), { characterCount: increment(-1), lastDeletedCharId: 'c1' });
    await assertSucceeds(batch.commit());
  });

  test('a character can still be deleted on its own', async () => {
    await assertSucceeds(deleteDoc(doc(dbFor('p1'), `${USERS}/p1/characters/c1`)));
  });

  test('portraits must be hosted here', async () => {
    const ref = doc(dbFor('p1'), `${USERS}/p1/characters/c1`);
    await assertFails(updateDoc(ref, { imageUrl: DOT_SEGMENTS }));
    await assertFails(updateDoc(ref, { imageUrl: 'https://evil.example/x.png' }));
    await assertSucceeds(updateDoc(ref, { imageUrl: '' }));
  });
});

describe('Codex pages', () => {
  const page = (extra = {}) => ({
    title: 'Aldric', content: 'A knight of the northern road.', gallery: [], category: 'Characters',
    creatorId: 'p1', lastEditorId: 'p1', status: 'pending', ...extra
  });

  test('may belong to a region or one of the writer\'s own characters only', async () => {
    const db = dbFor('p1');
    await assertSucceeds(setDoc(doc(db, `${DATA}/codex_pages/own`), page({ relatedId: 'c1' })));
    await assertSucceeds(setDoc(doc(db, `${DATA}/codex_pages/region`), page({ relatedId: '12' })));
    await assertFails(setDoc(doc(db, `${DATA}/codex_pages/theirs`), page({ relatedId: 'c2' })));
  });

  test('another player cannot unlink or redirect someone\'s page', async () => {
    await seed(`${DATA}/codex_pages/brynn`, page({ title: 'Brynn', relatedId: 'c2', creatorId: 'p2', lastEditorId: 'p2', status: 'approved' }));
    const ref = doc(dbFor('p1'), `${DATA}/codex_pages/brynn`);
    await assertFails(updateDoc(ref, { relatedId: '', lastEditorId: 'p1' }));
    await assertFails(updateDoc(ref, { relatedId: 'c1', lastEditorId: 'p1' }));
  });

  test('titles may be a single letter; categories are short and clean', async () => {
    const db = dbFor('p1');
    await assertSucceeds(setDoc(doc(db, `${DATA}/codex_pages/bo`), page({ title: 'Bo' })));
    await assertFails(setDoc(doc(db, `${DATA}/codex_pages/blank`), page({ title: '   ' })));
    await assertFails(setDoc(doc(db, `${DATA}/codex_pages/cat1`), page({ category: 'x'.repeat(200) })));
    await assertFails(setDoc(doc(db, `${DATA}/codex_pages/cat2`), page({ category: 'free money' })));
  });

  test('gallery and portrait images must be hosted here', async () => {
    const db = dbFor('p1');
    await assertSucceeds(setDoc(doc(db, `${DATA}/codex_pages/g1`), page({ gallery: [HOSTED], imageUrl: HOSTED })));
    await assertFails(setDoc(doc(db, `${DATA}/codex_pages/g2`), page({ gallery: [HOSTED, DOT_SEGMENTS] })));
    await assertFails(setDoc(doc(db, `${DATA}/codex_pages/g3`), page({ imageUrl: 'https://evil.example/x.png' })));
  });

  test('a rejected page returns to moderation only with changes', async () => {
    await seed(`${DATA}/codex_pages/r1`, page({ status: 'rejected' }));
    const ref = doc(dbFor('p1'), `${DATA}/codex_pages/r1`);
    await assertFails(updateDoc(ref, { status: 'pending', lastEditorId: 'p1' }));
    await assertSucceeds(updateDoc(ref, { status: 'pending', lastEditorId: 'p1', content: 'A knight of the southern road.' }));
  });
});
