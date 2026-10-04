/**
 * @jest-environment node
 */
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, writeBatch, serverTimestamp, Timestamp } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'realm-of-aethelraed';
const CHAT_PATH = 'artifacts/realm-of-allania-v2/chats/chat_123';

describe('Firestore Security Rules - Chats', () => {
    let testEnv;

    beforeAll(async () => {
        const rules = fs.readFileSync(path.resolve(__dirname, './firestore.rules'), 'utf8');
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
        // A chat whose last activity was a minute ago (outside the 1s flood window)
        await testEnv.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), CHAT_PATH), {
            participants: ['alice', 'bob'],
            lastMessage: 'Chat started',
            updatedAt: Timestamp.fromDate(new Date(Date.now() - 60000))
        }));
    });

    const dbFor = (uid, token = { email_verified: true }) => testEnv.authenticatedContext(uid, token).firestore();

    // How the client sends: message + chat bump in one batch
    const sendMessage = (db, id, message) => {
        const batch = writeBatch(db);
        batch.set(doc(db, `${CHAT_PATH}/messages/${id}`), { createdAt: serverTimestamp(), ...message });
        batch.update(doc(db, CHAT_PATH), { lastMessage: String(message.text).slice(0, 50), updatedAt: serverTimestamp() });
        return batch.commit();
    };

    it('should allow participants to send valid messages', async () => {
        await assertSucceeds(sendMessage(dbFor('alice'), 'msg_1', { senderId: 'alice', text: 'Hello world' }));
    });

    it('should deny messages written without bumping the chat (flood-control bypass)', async () => {
        const db = dbFor('alice');
        await assertFails(setDoc(doc(db, `${CHAT_PATH}/messages/msg_1`), {
            senderId: 'alice', text: 'Spam', createdAt: serverTimestamp()
        }));
    });

    it('should deny a second message within the same second', async () => {
        const db = dbFor('alice');
        await assertSucceeds(sendMessage(db, 'msg_1', { senderId: 'alice', text: 'One' }));
        await assertFails(sendMessage(db, 'msg_2', { senderId: 'alice', text: 'Two' }));
    });

    it('should deny setting the chat timestamp into the future (would block the other person)', async () => {
        await assertFails(updateDoc(doc(dbFor('alice'), CHAT_PATH), {
            lastMessage: 'x', updatedAt: Timestamp.fromDate(new Date('2999-01-01'))
        }));
    });

    it('should deny non-participants from sending messages', async () => {
        await assertFails(sendMessage(dbFor('eve'), 'msg_2', { senderId: 'eve', text: 'I am hacking' }));
    });

    it('should deny unverified accounts from sending messages', async () => {
        await assertFails(sendMessage(dbFor('alice', { email_verified: false }), 'msg_2', { senderId: 'alice', text: 'Hi' }));
    });

    it('should deny sending messages with wrong senderId (Spoofing)', async () => {
        await assertFails(sendMessage(dbFor('alice'), 'msg_3', { senderId: 'bob', text: 'Spoofed message' }));
    });

    it('should deny empty or too long messages', async () => {
        const db = dbFor('alice');
        await assertFails(sendMessage(db, 'fail_1', { senderId: 'alice', text: '' }));
        await assertFails(sendMessage(db, 'fail_2', { senderId: 'alice', text: 'a'.repeat(2001) }));
    });

    it('should deny updating messages (Immutability)', async () => {
        const messagePath = `${CHAT_PATH}/messages/msg_update`;
        await testEnv.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), messagePath), {
            senderId: 'alice', text: 'Original', createdAt: new Date()
        }));
        await assertFails(updateDoc(doc(dbFor('alice'), messagePath), { text: 'Edited' }));
    });

    it('should allow starting a chat with a server timestamp', async () => {
        await assertSucceeds(setDoc(doc(dbFor('alice'), 'artifacts/realm-of-allania-v2/chats/new_chat'), {
            participants: ['alice', 'carol'],
            participantNames: { alice: 'Alice', carol: 'Carol' },
            lastMessage: 'Chat started',
            updatedAt: serverTimestamp()
        }));
    });
});
