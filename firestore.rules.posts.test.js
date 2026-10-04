const { assertFails, assertSucceeds, initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const {
  setDoc, doc, updateDoc, getDoc, writeBatch, collection, serverTimestamp, increment, Timestamp
} = require('firebase/firestore');
const fs = require('fs');

const PROJECT_ID = 'realm-of-aethelraed-test';
const APP_ID = 'realm-of-allania-v2';
const DATA = `artifacts/${APP_ID}/public/data`;

let testEnv;

// Signed-in users have verified emails unless a test says otherwise
const dbFor = (uid, token = { email_verified: true }) => testEnv.authenticatedContext(uid, token).firestore();
const seed = (path, data) => testEnv.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), path), data));

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
  await seed(`artifacts/${APP_ID}/users/user1/settings/account`, { role: 'user', characterCount: 1 });
  await seed(`artifacts/${APP_ID}/users/user2/settings/account`, { role: 'user' });
  await seed(`artifacts/${APP_ID}/users/trusted1/settings/account`, { role: 'trusted' });
  await seed(`artifacts/${APP_ID}/users/mod1/settings/account`, { role: 'moderator' });
  await seed(`artifacts/${APP_ID}/users/banned1/settings/account`, { role: 'banned' });
  await seed(`artifacts/${APP_ID}/users/user1/characters/char1`, { name: 'Aldric the Bold', race: 'Human', class: 'Knight' });
  // An approved thread anyone may reply to
  await seed(`${DATA}/threads/thread1`, {
    title: 'A Grand Adventure', regionId: '12', creatorId: 'user2', status: 'approved', postCount: 1
  });
});

const postData = {
  content: 'Valid content checks out.',
  threadId: 'thread1',
  userId: 'user1',
  status: 'pending',
  createdAt: new Date().toISOString()
};

describe('Firestore Rules: Posts', () => {
  test('User can create post with status "pending"', async () => {
    await assertSucceeds(setDoc(doc(dbFor('user1'), `${DATA}/posts/post1`), postData));
  });

  test('User cannot create post with status "approved"', async () => {
    await assertFails(setDoc(doc(dbFor('user1'), `${DATA}/posts/post2`), { ...postData, status: 'approved' }));
  });

  test('Trusted users also go through the moderation function (no self-approval)', async () => {
    await assertFails(setDoc(doc(dbFor('trusted1'), `${DATA}/posts/post3`), {
      ...postData, userId: 'trusted1', status: 'approved'
    }));
    await assertSucceeds(setDoc(doc(dbFor('trusted1'), `${DATA}/posts/post3`), { ...postData, userId: 'trusted1' }));
  });

  test('Unverified email cannot post', async () => {
    await assertFails(setDoc(doc(dbFor('user1', { email_verified: false }), `${DATA}/posts/post1`), postData));
  });

  test('Banned user cannot post', async () => {
    await assertFails(setDoc(doc(dbFor('banned1'), `${DATA}/posts/post1`), { ...postData, userId: 'banned1' }));
  });

  test('Cannot post into a thread that does not exist', async () => {
    await assertFails(setDoc(doc(dbFor('user1'), `${DATA}/posts/post1`), { ...postData, threadId: 'nope' }));
  });

  test('Cannot post into a rejected thread (no resurrecting it through an approved post)', async () => {
    await seed(`${DATA}/threads/rejected1`, { title: 'Bad', regionId: '1', creatorId: 'user1', status: 'rejected' });
    await assertFails(setDoc(doc(dbFor('user1'), `${DATA}/posts/post1`), { ...postData, threadId: 'rejected1' }));
  });

  test('Cannot post into someone else\'s pending thread', async () => {
    await seed(`${DATA}/threads/pending2`, { title: 'Hidden', regionId: '1', creatorId: 'user2', status: 'pending' });
    await assertFails(setDoc(doc(dbFor('user1'), `${DATA}/posts/post1`), { ...postData, threadId: 'pending2' }));
  });

  test('Cannot pre-set moderation fields on create', async () => {
    await assertFails(setDoc(doc(dbFor('user1'), `${DATA}/posts/post1`), { ...postData, moderationMethod: 'trusted-user' }));
  });

  test('Content edits must send the post back to pending', async () => {
    await seed(`${DATA}/posts/post1`, { ...postData, status: 'approved' });
    const ref = doc(dbFor('user1'), `${DATA}/posts/post1`);
    await assertFails(updateDoc(ref, { content: 'Swapped in after approval!' }));
    await assertSucceeds(updateDoc(ref, { content: 'An honest correction here.', status: 'pending' }));
  });

  test('Edits of flagged posts must also go back to pending (no swap before mod review)', async () => {
    await seed(`${DATA}/posts/post1`, { ...postData, status: 'needs_review' });
    const ref = doc(dbFor('user1'), `${DATA}/posts/post1`);
    await assertFails(updateDoc(ref, { content: 'Swapped while a mod looks.' }));
    await assertSucceeds(updateDoc(ref, { content: 'Swapped while a mod looks.', status: 'pending' }));
  });

  test('User cannot set status to anything but pending', async () => {
    await seed(`${DATA}/posts/post1`, postData);
    await assertFails(updateDoc(doc(dbFor('user1'), `${DATA}/posts/post1`), { status: 'approved' }));
  });

  test('User cannot change denormalized character fields after posting', async () => {
    await seed(`${DATA}/posts/post1`, { ...postData, status: 'approved' });
    await assertFails(updateDoc(doc(dbFor('user1'), `${DATA}/posts/post1`), {
      characterImageUrl: 'https://evil.example/x.png'
    }));
  });

  test('Moderator can update status field', async () => {
    await seed(`${DATA}/posts/post1`, postData);
    await assertSucceeds(updateDoc(doc(dbFor('mod1'), `${DATA}/posts/post1`), {
      status: 'approved', moderatedBy: 'mod1', moderationMethod: 'manual-admin'
    }));
  });

  test('Content must be between 10 and 5000 chars', async () => {
    const db = dbFor('user1');
    await assertFails(setDoc(doc(db, `${DATA}/posts/postShort`), { ...postData, content: 'Short' }));
    await assertFails(setDoc(doc(db, `${DATA}/posts/postLong`), { ...postData, content: 'a'.repeat(5001) }));
  });
});

describe('Firestore Rules: Threads', () => {
  const newThread = {
    title: 'A New Adventure',
    regionId: '12',
    creatorId: 'user1',
    status: 'pending',
    postCount: 1
  };

  test('User can create a pending thread together with its first post', async () => {
    const db = dbFor('user1');
    const batch = writeBatch(db);
    const threadRef = doc(collection(db, `${DATA}/threads`));
    batch.set(threadRef, { ...newThread, updatedAt: serverTimestamp(), createdAt: serverTimestamp() });
    batch.set(doc(collection(db, `${DATA}/posts`)), { ...postData, threadId: threadRef.id });
    await assertSucceeds(batch.commit());
  });

  test('Thread timestamps must come from the server', async () => {
    await assertFails(setDoc(doc(dbFor('user1'), `${DATA}/threads/t2`), {
      ...newThread, updatedAt: Timestamp.fromDate(new Date('2999-01-01'))
    }));
  });

  test('Only mods may create an approved or locked thread', async () => {
    const db = dbFor('trusted1');
    await assertFails(setDoc(doc(db, `${DATA}/threads/t2`), {
      ...newThread, creatorId: 'trusted1', status: 'approved', updatedAt: serverTimestamp()
    }));
    await assertFails(setDoc(doc(db, `${DATA}/threads/t3`), {
      ...newThread, creatorId: 'trusted1', isLocked: true, updatedAt: serverTimestamp()
    }));
  });

  test('Replying bumps postCount by 1 with a server timestamp', async () => {
    const ref = doc(dbFor('user1'), `${DATA}/threads/thread1`);
    await assertSucceeds(updateDoc(ref, { postCount: increment(1), updatedAt: serverTimestamp() }));
  });

  test('Cannot pin a thread to the top with a future updatedAt', async () => {
    const ref = doc(dbFor('user1'), `${DATA}/threads/thread1`);
    await assertFails(updateDoc(ref, { postCount: 2, updatedAt: Timestamp.fromDate(new Date('2999-01-01')) }));
  });

  test('Bump must increment postCount by exactly 1 and touch nothing else', async () => {
    const ref = doc(dbFor('user1'), `${DATA}/threads/thread1`);
    await assertFails(updateDoc(ref, { postCount: 99, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { postCount: 2, updatedAt: serverTimestamp(), title: 'Hijacked Title' }));
    await assertFails(updateDoc(ref, { postCount: 2, updatedAt: serverTimestamp(), status: 'rejected' }));
  });

  test('Creator cannot rename an approved thread (the title was moderated)', async () => {
    const ref = doc(dbFor('user2'), `${DATA}/threads/thread1`);
    await assertFails(updateDoc(ref, { title: 'Something unmoderated' }));
  });

  test('Creator can still change the banner', async () => {
    const ref = doc(dbFor('user2'), `${DATA}/threads/thread1`);
    await assertSucceeds(updateDoc(ref, { bannerUrl: 'https://firebasestorage.googleapis.com/x', bannerPosition: 'center' }));
  });

  test('Creator cannot self-approve own thread', async () => {
    await seed(`${DATA}/threads/t2`, { ...newThread });
    await assertFails(updateDoc(doc(dbFor('user1'), `${DATA}/threads/t2`), { status: 'approved' }));
  });

  test('Moderator can approve a thread', async () => {
    await seed(`${DATA}/threads/t2`, { ...newThread });
    await assertSucceeds(updateDoc(doc(dbFor('mod1'), `${DATA}/threads/t2`), { status: 'approved' }));
  });
});

describe('Firestore Rules: Codex pages', () => {
  const page = {
    title: 'The Old Keep',
    content: 'A ruined keep on the northern ridge.',
    gallery: [],
    creatorId: 'user1',
    lastEditorId: 'user1',
    status: 'pending'
  };

  test('User can create a pending page, not an approved or locked one', async () => {
    const db = dbFor('user1');
    await assertSucceeds(setDoc(doc(db, `${DATA}/codex_pages/p1`), page));
    await assertFails(setDoc(doc(dbFor('trusted1'), `${DATA}/codex_pages/p2`), {
      ...page, creatorId: 'trusted1', lastEditorId: 'trusted1', status: 'approved'
    }));
    await assertFails(setDoc(doc(db, `${DATA}/codex_pages/p3`), { ...page, isLocked: true }));
  });

  test('Wiki edits by anyone must go back to pending', async () => {
    await seed(`${DATA}/codex_pages/p1`, { ...page, status: 'approved' });
    const ref = doc(dbFor('user2'), `${DATA}/codex_pages/p1`);
    await assertFails(updateDoc(ref, { content: 'Vandalised content here.', lastEditorId: 'user2' }));
    await assertSucceeds(updateDoc(ref, { content: 'Improved content here.', lastEditorId: 'user2', status: 'pending' }));
  });

  test('Editors cannot touch the approved snapshot used to undo vandalism', async () => {
    await seed(`${DATA}/codex_pages/p1`, { ...page, status: 'approved', approvedSnapshot: { title: 'x', content: 'y' } });
    await assertFails(updateDoc(doc(dbFor('user2'), `${DATA}/codex_pages/p1`), {
      lastEditorId: 'user2', status: 'pending', approvedSnapshot: { title: 'Evil', content: 'Evil content here' }
    }));
  });
});

describe('Firestore Rules: Characters', () => {
  const character = { name: 'Brynn', race: 'Elf', class: 'Ranger', description: 'Quiet.', imageUrl: '', imagePosition: 'center' };

  test('Creating a character must bump the counter in the same batch', async () => {
    const db = dbFor('user1');
    await assertFails(setDoc(doc(db, `artifacts/${APP_ID}/users/user1/characters/c2`), character));

    const batch = writeBatch(db);
    batch.set(doc(db, `artifacts/${APP_ID}/users/user1/characters/c2`), character);
    batch.update(doc(db, `artifacts/${APP_ID}/users/user1/settings/account`), { characterCount: increment(1) });
    await assertSucceeds(batch.commit());
  });

  test('Banned users cannot edit their characters', async () => {
    await seed(`artifacts/${APP_ID}/users/banned1/characters/c1`, character);
    await assertFails(updateDoc(doc(dbFor('banned1'), `artifacts/${APP_ID}/users/banned1/characters/c1`), { name: 'Slur' }));
  });

  test('Character profiles are filtered for blocked words', async () => {
    await seed(`artifacts/${APP_ID}/users/user1/characters/c1`, character);
    const ref = doc(dbFor('user1'), `artifacts/${APP_ID}/users/user1/characters/c1`);
    await assertFails(updateDoc(ref, { description: 'Selling cheap rolex watches' }));
    await assertFails(updateDoc(ref, { name: 'Kys' }));
    await assertSucceeds(updateDoc(ref, { name: 'Alkyshire Wanderer' }));
  });

  test('Only staff may use staff-looking character names', async () => {
    await seed(`artifacts/${APP_ID}/users/user1/characters/c1`, character);
    await seed(`artifacts/${APP_ID}/users/mod1/characters/c1`, character);
    await assertFails(updateDoc(doc(dbFor('user1'), `artifacts/${APP_ID}/users/user1/characters/c1`), { name: 'Official Moderator' }));
    await assertSucceeds(updateDoc(doc(dbFor('mod1'), `artifacts/${APP_ID}/users/mod1/characters/c1`), { name: 'Moderator Brynn' }));
  });

  test('Character text is size-limited', async () => {
    await seed(`artifacts/${APP_ID}/users/user1/characters/c1`, character);
    const ref = doc(dbFor('user1'), `artifacts/${APP_ID}/users/user1/characters/c1`);
    await assertFails(updateDoc(ref, { description: 'x'.repeat(5001) }));
    await assertSucceeds(updateDoc(ref, { description: 'A ranger of the north.' }));
  });
});

describe('Firestore Rules: Accounts and presence', () => {
  test('User cannot promote themselves', async () => {
    const ref = doc(dbFor('user1'), `artifacts/${APP_ID}/users/user1/settings/account`);
    await assertFails(updateDoc(ref, { role: 'trusted' }));
    await assertFails(updateDoc(ref, { promotionReason: 'trust me' }));
  });

  test('Banned users cannot write presence', async () => {
    await assertFails(setDoc(doc(dbFor('banned1'), `artifacts/${APP_ID}/presence/banned1`), { username: 'x' }));
    await assertSucceeds(setDoc(doc(dbFor('user1'), `artifacts/${APP_ID}/presence/user1`), { username: 'x' }));
  });

  test('Display names in Active Users are filtered', async () => {
    const ref = doc(dbFor('user1'), `artifacts/${APP_ID}/presence/user1`);
    await assertFails(setDoc(ref, { username: 'Site Admin' }));
    await assertFails(setDoc(ref, { username: 'free money bot' }));
    await assertSucceeds(setDoc(ref, { username: 'Wanderer' }));
  });
});

describe('Firestore Rules: Read restrictions on unapproved content', () => {
  const seedPost = (status) => seed(`${DATA}/posts/readTest`, {
    content: 'Valid content checks out.',
    threadId: 'thread1',
    userId: 'user1',
    ...(status ? { status } : {})
  });

  test('Anyone (even unauthenticated) can read an approved post', async () => {
    await seedPost('approved');
    await assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), `${DATA}/posts/readTest`)));
  });

  test('Other users cannot read a pending or rejected post', async () => {
    await seedPost('pending');
    await assertFails(getDoc(doc(dbFor('user2'), `${DATA}/posts/readTest`)));
    await seedPost('rejected');
    await assertFails(getDoc(doc(dbFor('user2'), `${DATA}/posts/readTest`)));
  });

  test('The author and moderators can read a pending post', async () => {
    await seedPost('pending');
    await assertSucceeds(getDoc(doc(dbFor('user1'), `${DATA}/posts/readTest`)));
    await assertSucceeds(getDoc(doc(dbFor('mod1'), `${DATA}/posts/readTest`)));
  });

  test('Legacy posts without status remain readable', async () => {
    await seedPost(null);
    await assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), `${DATA}/posts/readTest`)));
  });
});

describe('Firestore Rules: Anti-impersonation (characterName)', () => {
  test('Post with characterName matching own character succeeds', async () => {
    await assertSucceeds(setDoc(doc(dbFor('user1'), `${DATA}/posts/postChar`), {
      ...postData, characterId: 'char1', characterName: 'Aldric the Bold'
    }));
  });

  test('Post with spoofed characterName is denied', async () => {
    await assertFails(setDoc(doc(dbFor('user1'), `${DATA}/posts/postSpoof`), {
      ...postData, characterId: 'char1', characterName: 'Definitely A Moderator'
    }));
  });

  test('Post with characterName but no characterId is denied', async () => {
    await assertFails(setDoc(doc(dbFor('user1'), `${DATA}/posts/postNoChar`), {
      ...postData, characterName: 'Aldric the Bold'
    }));
  });
});
