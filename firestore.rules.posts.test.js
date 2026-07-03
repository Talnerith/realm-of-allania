
const { assertFails, assertSucceeds, initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { setDoc, doc, updateDoc, getDoc } = require('firebase/firestore');
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

describe('Firestore Rules: Threads', () => {
  const threadData = {
    title: 'A Grand Adventure',
    regionId: '12',
    creatorId: 'user1',
    status: 'pending',
    postCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const seedThread = async (data = threadData) => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `artifacts/${APP_ID}/public/data/threads/thread1`), data);
    });
  };

  test('User can create thread with status "pending"', async () => {
    const userDb = testEnv.authenticatedContext('user1').firestore();
    await assertSucceeds(setDoc(doc(userDb, `artifacts/${APP_ID}/public/data/threads/threadNew`), threadData));
  });

  test('User cannot create thread with status "approved" (moderation bypass)', async () => {
    const userDb = testEnv.authenticatedContext('user1').firestore();
    await assertFails(setDoc(doc(userDb, `artifacts/${APP_ID}/public/data/threads/threadNew`), {
      ...threadData,
      status: 'approved'
    }));
  });

  test('Trusted user can create thread with status "approved"', async () => {
    const trustedDb = testEnv.authenticatedContext('trusted1').firestore();
    await assertSucceeds(setDoc(doc(trustedDb, `artifacts/${APP_ID}/public/data/threads/threadNew`), {
      ...threadData,
      creatorId: 'trusted1',
      status: 'approved'
    }));
  });

  test('Non-creator can bump postCount/updatedAt when replying', async () => {
    await seedThread();
    const otherDb = testEnv.authenticatedContext('user2').firestore();
    await assertSucceeds(updateDoc(doc(otherDb, `artifacts/${APP_ID}/public/data/threads/thread1`), {
      postCount: 2,
      updatedAt: new Date().toISOString()
    }));
  });

  test('Non-creator bump must increment postCount by exactly 1', async () => {
    await seedThread();
    const otherDb = testEnv.authenticatedContext('user2').firestore();
    await assertFails(updateDoc(doc(otherDb, `artifacts/${APP_ID}/public/data/threads/thread1`), {
      postCount: 99,
      updatedAt: new Date().toISOString()
    }));
  });

  test('Non-creator cannot change title or status while bumping', async () => {
    await seedThread();
    const otherDb = testEnv.authenticatedContext('user2').firestore();
    await assertFails(updateDoc(doc(otherDb, `artifacts/${APP_ID}/public/data/threads/thread1`), {
      postCount: 2,
      updatedAt: new Date().toISOString(),
      title: 'Hijacked Title'
    }));
    await assertFails(updateDoc(doc(otherDb, `artifacts/${APP_ID}/public/data/threads/thread1`), {
      postCount: 2,
      updatedAt: new Date().toISOString(),
      status: 'approved'
    }));
  });

  test('Creator cannot self-approve own thread', async () => {
    await seedThread();
    const creatorDb = testEnv.authenticatedContext('user1').firestore();
    await assertFails(updateDoc(doc(creatorDb, `artifacts/${APP_ID}/public/data/threads/thread1`), {
      status: 'approved'
    }));
  });

  test('Moderator can approve a thread', async () => {
    await seedThread();
    const modDb = testEnv.authenticatedContext('mod1').firestore();
    await assertSucceeds(updateDoc(doc(modDb, `artifacts/${APP_ID}/public/data/threads/thread1`), {
      status: 'approved'
    }));
  });
});

describe('Firestore Rules: Read restrictions on unapproved content', () => {
  const seedPost = async (status) => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `artifacts/${APP_ID}/public/data/posts/readTest`), {
        content: 'Valid content checks out.',
        threadId: 'thread1',
        userId: 'user1',
        ...(status ? { status } : {})
      });
    });
  };

  test('Anyone (even unauthenticated) can read an approved post', async () => {
    await seedPost('approved');
    const guestDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(guestDb, `artifacts/${APP_ID}/public/data/posts/readTest`)));
  });

  test('Other users cannot read a pending post', async () => {
    await seedPost('pending');
    const otherDb = testEnv.authenticatedContext('user2').firestore();
    await assertFails(getDoc(doc(otherDb, `artifacts/${APP_ID}/public/data/posts/readTest`)));
  });

  test('Other users cannot read a rejected post', async () => {
    await seedPost('rejected');
    const otherDb = testEnv.authenticatedContext('user2').firestore();
    await assertFails(getDoc(doc(otherDb, `artifacts/${APP_ID}/public/data/posts/readTest`)));
  });

  test('The author can read their own pending post', async () => {
    await seedPost('pending');
    const ownerDb = testEnv.authenticatedContext('user1').firestore();
    await assertSucceeds(getDoc(doc(ownerDb, `artifacts/${APP_ID}/public/data/posts/readTest`)));
  });

  test('Moderators can read pending posts', async () => {
    await seedPost('pending');
    const modDb = testEnv.authenticatedContext('mod1').firestore();
    await assertSucceeds(getDoc(doc(modDb, `artifacts/${APP_ID}/public/data/posts/readTest`)));
  });

  test('Legacy posts without status remain readable', async () => {
    await seedPost(null);
    const guestDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(guestDb, `artifacts/${APP_ID}/public/data/posts/readTest`)));
  });
});

describe('Firestore Rules: Anti-impersonation (characterName)', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `artifacts/${APP_ID}/users/user1/characters/char1`), {
        name: 'Aldric the Bold', race: 'Human', class: 'Knight'
      });
    });
  });

  const basePost = {
    content: 'Valid content checks out.',
    threadId: 'thread1',
    userId: 'user1',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  test('Post with characterName matching own character succeeds', async () => {
    const userDb = testEnv.authenticatedContext('user1').firestore();
    await assertSucceeds(setDoc(doc(userDb, `artifacts/${APP_ID}/public/data/posts/postChar`), {
      ...basePost,
      characterId: 'char1',
      characterName: 'Aldric the Bold'
    }));
  });

  test('Post with spoofed characterName is denied', async () => {
    const userDb = testEnv.authenticatedContext('user1').firestore();
    await assertFails(setDoc(doc(userDb, `artifacts/${APP_ID}/public/data/posts/postSpoof`), {
      ...basePost,
      characterId: 'char1',
      characterName: 'Definitely A Moderator'
    }));
  });

  test('Post with characterName but no characterId is denied', async () => {
    const userDb = testEnv.authenticatedContext('user1').firestore();
    await assertFails(setDoc(doc(userDb, `artifacts/${APP_ID}/public/data/posts/postNoChar`), {
      ...basePost,
      characterName: 'Aldric the Bold'
    }));
  });
});
