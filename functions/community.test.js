const mockDocs = {};
const mockDoc = jest.fn((path) => mockDocs[path] || (mockDocs[path] = {
    get: jest.fn(), update: jest.fn().mockResolvedValue(), set: jest.fn().mockResolvedValue()
}));

jest.mock('firebase-admin', () => ({ firestore: jest.fn(() => ({ doc: mockDoc })) }));
jest.mock('firebase-admin/firestore', () => ({
    FieldValue: { increment: (n) => ({ increment: n }), serverTimestamp: () => 'now' },
    FieldPath: { documentId: () => '__name__' }
}));
jest.mock('firebase-functions/v2/firestore', () => ({ onDocumentWritten: jest.fn((options, handler) => handler) }));
jest.mock('firebase-functions/v2/scheduler', () => ({ onSchedule: jest.fn((options, handler) => handler) }));

const { countPostLikes, likeDelta } = require('./community');

const DATA = 'artifacts/realm-of-allania-v2/public/data';
const snap = (data) => ({ exists: !!data, data: () => data });
const event = (before, after) => ({
    params: { postId: 'p1', likerId: 'u2' },
    data: { before: snap(before), after: snap(after) }
});

describe('likeDelta', () => {
    it('counts a new like up and a removed like down', () => {
        expect(likeDelta(null, { createdAt: 1 })).toBe(1);
        expect(likeDelta({ createdAt: 1 }, null)).toBe(-1);
        expect(likeDelta({ createdAt: 1 }, { createdAt: 2 })).toBe(0);
    });
});

describe('countPostLikes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        for (const k of Object.keys(mockDocs)) delete mockDocs[k];
    });

    it('increments the post and the author reputation', async () => {
        mockDoc(`${DATA}/posts/p1`).get.mockResolvedValue({ exists: true, data: () => ({ userId: 'author1' }) });
        await countPostLikes(event(null, { createdAt: 1 }));
        expect(mockDocs[`${DATA}/posts/p1`].update).toHaveBeenCalledWith({ likeCount: { increment: 1 } });
        expect(mockDocs[`${DATA}/profiles/author1`].set).toHaveBeenCalledWith({ likesReceived: { increment: 1 } }, { merge: true });
    });

    it('decrements when a like is removed', async () => {
        mockDoc(`${DATA}/posts/p1`).get.mockResolvedValue({ exists: true, data: () => ({ userId: 'author1' }) });
        await countPostLikes(event({ createdAt: 1 }, null));
        expect(mockDocs[`${DATA}/posts/p1`].update).toHaveBeenCalledWith({ likeCount: { increment: -1 } });
    });

    it('does nothing for a deleted post', async () => {
        mockDoc(`${DATA}/posts/p1`).get.mockResolvedValue({ exists: false });
        await countPostLikes(event(null, { createdAt: 1 }));
        expect(mockDocs[`${DATA}/posts/p1`].update).not.toHaveBeenCalled();
        expect(mockDocs[`${DATA}/profiles/author1`]).toBeUndefined();
    });
});
