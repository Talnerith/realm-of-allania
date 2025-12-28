/**
 * @jest-environment node
 */
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'realm-of-aethelraed';

describe('Firestore Security Rules - Chats', () => {
    let testEnv;

    beforeAll(async () => {
        const rules = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8');
        testEnv = await initializeTestEnvironment({
            projectId: PROJECT_ID,
            firestore: {
                rules,
                host: '127.0.0.1',
                port: 8080 // Default emulator port
            }
        });
    });

    afterAll(async () => {
        await testEnv.cleanup();
    });

    beforeEach(async () => {
        await testEnv.clearFirestore();
    });

    const getDb = (auth) => {
        const token = auth ? { ...auth, sub: auth.uid } : undefined;
        // Remove uid to avoid "uid field is no longer supported" error
        if (token && token.uid) delete token.uid;
        return testEnv.authenticatedContext(auth ? auth.uid : 'alice', token).firestore();
    };
    const getAdminDb = () => testEnv.unauthenticatedContext().firestore(); // Admin bypass not strictly needed if we setup data correctly

    it('should allow participants to send valid messages', async () => {
        const aliceDb = getDb({ uid: 'alice' });

        // Setup: Create a chat where alice is a participant
        // Note: We might need admin privileges or a valid setup to create the parent chat first
        // But since we are mocking the DB state for the get() call, we just need the document to exist.
        // However, rules unit testing uses the actual emulator. So we must write the chat doc first.

        // Bypass rules using rules-unit-testing specific method if needed, or just use a valid write.
        // Let's try to write the chat doc as alice (assuming chat creation rules work and alice is participant)

        const chatId = 'chat_123';
        const chatPath = `artifacts/realm-of-allania-v2/chats/${chatId}`;

        // Setup chat document using `withSecurityRulesDisabled` to ensure it exists for the test
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await context.firestore().doc(chatPath).set({
                participants: ['alice', 'bob']
            });
        });

        // Test creating a message
        const messagePath = `${chatPath}/messages/msg_1`;
        await assertSucceeds(aliceDb.doc(messagePath).set({
            senderId: 'alice',
            text: 'Hello world',
            createdAt: new Date()
        }));
    });

    it('should deny non-participants from sending messages', async () => {
        const eveDb = getDb({ uid: 'eve' }); // Eve is not in participants

        const chatId = 'chat_123';
        const chatPath = `artifacts/realm-of-allania-v2/chats/${chatId}`;

        await testEnv.withSecurityRulesDisabled(async (context) => {
            await context.firestore().doc(chatPath).set({
                participants: ['alice', 'bob']
            });
        });

        const messagePath = `${chatPath}/messages/msg_2`;
        await assertFails(eveDb.doc(messagePath).set({
            senderId: 'eve',
            text: 'I am hacking',
            createdAt: new Date()
        }));
    });

    it('should deny sending messages with wrong senderId (Spoofing)', async () => {
        const aliceDb = getDb({ uid: 'alice' });

        const chatId = 'chat_123';
        const chatPath = `artifacts/realm-of-allania-v2/chats/${chatId}`;

        await testEnv.withSecurityRulesDisabled(async (context) => {
            await context.firestore().doc(chatPath).set({
                participants: ['alice', 'bob']
            });
        });

        const messagePath = `${chatPath}/messages/msg_3`;
        // Alice tries to claim she is 'bob'
        await assertFails(aliceDb.doc(messagePath).set({
            senderId: 'bob',
            text: 'Spoofed message',
            createdAt: new Date()
        }));
    });

    it('should deny empty or too long messages', async () => {
        const aliceDb = getDb({ uid: 'alice' });

        const chatId = 'chat_123';
        const chatPath = `artifacts/realm-of-allania-v2/chats/${chatId}`;

        await testEnv.withSecurityRulesDisabled(async (context) => {
            await context.firestore().doc(chatPath).set({
                participants: ['alice', 'bob']
            });
        });

        // Empty text
        await assertFails(aliceDb.doc(`${chatPath}/messages/fail_1`).set({
            senderId: 'alice',
            text: '',
            createdAt: new Date()
        }));

        // Too long text (> 2000)
        const longText = 'a'.repeat(2001);
        await assertFails(aliceDb.doc(`${chatPath}/messages/fail_2`).set({
            senderId: 'alice',
            text: longText,
            createdAt: new Date()
        }));
    });

    it('should deny updating messages (Immutability)', async () => {
        const aliceDb = getDb({ uid: 'alice' });

        const chatId = 'chat_123';
        const chatPath = `artifacts/realm-of-allania-v2/chats/${chatId}`;
        const messagePath = `${chatPath}/messages/msg_update`;

        await testEnv.withSecurityRulesDisabled(async (context) => {
            await context.firestore().doc(chatPath).set({
                participants: ['alice', 'bob']
            });
            await context.firestore().doc(messagePath).set({
                senderId: 'alice',
                text: 'Original',
                createdAt: new Date()
            });
        });

        // Try to update text
        await assertFails(aliceDb.doc(messagePath).update({
            text: 'Edited'
        }));
    });
});
