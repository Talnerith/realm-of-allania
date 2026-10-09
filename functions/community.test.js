// In-memory documents plus a like count per post, behind a fake transaction
const mockStore = {};
const mockLikeCounts = {};
const mockWrites = [];

const mockRef = (path) => ({
    path,
    collection: (sub) => ({ count: () => ({ countOf: `${path}/${sub}` }) })
});
const mockSnap = (path) => {
    const data = mockStore[path];
    return { exists: data !== undefined, data: () => data, get: (key) => data?.[key] };
};
const mockTx = {
    get: jest.fn(async (refOrQuery) => (refOrQuery.countOf
        ? { data: () => ({ count: mockLikeCounts[refOrQuery.countOf] ?? 0 }) }
        : mockSnap(refOrQuery.path))),
    update: jest.fn((ref, data) => {
        mockWrites.push({ op: 'update', path: ref.path, data });
        const next = { ...mockStore[ref.path] };
        for (const [k, v] of Object.entries(data)) next[k] = v?.increment !== undefined ? (next[k] || 0) + v.increment : v;
        mockStore[ref.path] = next;
    }),
    set: jest.fn((ref, data) => {
        mockWrites.push({ op: 'set', path: ref.path, data });
        const next = { ...mockStore[ref.path] };
        for (const [k, v] of Object.entries(data)) next[k] = v?.increment !== undefined ? (next[k] || 0) + v.increment : v;
        mockStore[ref.path] = next;
    })
};
const mockDb = { doc: mockRef, runTransaction: jest.fn((fn) => fn(mockTx)) };

jest.mock('firebase-admin', () => ({ firestore: jest.fn(() => mockDb) }));
jest.mock('firebase-admin/firestore', () => ({
    FieldValue: { increment: (n) => ({ increment: n }), serverTimestamp: () => 'now' },
    FieldPath: { documentId: () => '__name__' }
}));
jest.mock('firebase-functions/v2/firestore', () => ({ onDocumentWritten: jest.fn((options, handler) => handler) }));
jest.mock('firebase-functions/v2/scheduler', () => ({ onSchedule: jest.fn((options, handler) => handler) }));

const { countPostLikes, likeDelta } = require('./community');

const DATA = 'artifacts/realm-of-allania-v2/public/data';
const POST = `${DATA}/posts/p1`;
const PROFILE = `${DATA}/profiles/author1`;
const CHARACTER = 'artifacts/realm-of-allania-v2/users/author1/characters/c1';
const snap = (data) => ({ exists: !!data, data: () => data });
const event = (before, after) => ({
    params: { postId: 'p1', likerId: 'u2' },
    data: { before: snap(before), after: snap(after) }
});
const like = (n = 1) => event(null, { createdAt: n });
const unlike = () => event({ createdAt: 1 }, null);

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
        for (const k of Object.keys(mockStore)) delete mockStore[k];
        for (const k of Object.keys(mockLikeCounts)) delete mockLikeCounts[k];
        mockWrites.length = 0;
        mockStore[POST] = { userId: 'author1', characterId: 'c1' };
        mockStore[PROFILE] = { displayName: 'Author' };
        mockStore[CHARACTER] = { name: 'Aldric' };
    });

    it('stores the recounted total and credits the author and character', async () => {
        mockLikeCounts[`${POST}/likes`] = 1;
        await countPostLikes(like());
        expect(mockStore[POST].likeCount).toBe(1);
        expect(mockStore[PROFILE].likesReceived).toBe(1);
        expect(mockStore[CHARACTER].likesReceived).toBe(1);
    });

    it('is idempotent: a duplicate delivery changes nothing', async () => {
        mockLikeCounts[`${POST}/likes`] = 1;
        await countPostLikes(like());
        await countPostLikes(like()); // same event delivered again
        expect(mockStore[POST].likeCount).toBe(1);
        expect(mockStore[PROFILE].likesReceived).toBe(1);
        expect(mockStore[CHARACTER].likesReceived).toBe(1);
    });

    it('moves reputation by the real change, never below what the likes support', async () => {
        // Two likes then one removal, the removal delivered twice
        mockStore[POST].likeCount = 2;
        mockStore[PROFILE].likesReceived = 2;
        mockLikeCounts[`${POST}/likes`] = 1;
        await countPostLikes(unlike());
        await countPostLikes(unlike());
        expect(mockStore[POST].likeCount).toBe(1);
        expect(mockStore[PROFILE].likesReceived).toBe(1);
    });

    it('catches up after out-of-order events', async () => {
        // The removal is processed first, while the like it undoes is still counted
        mockStore[POST].likeCount = 0;
        mockLikeCounts[`${POST}/likes`] = 0;
        await countPostLikes(unlike());
        expect(mockWrites).toEqual([]);
        await countPostLikes(like());
        expect(mockStore[POST].likeCount).toBe(0);
        expect(mockStore[PROFILE].likesReceived).toBeUndefined();
    });

    it('ignores a deleted character', async () => {
        delete mockStore[CHARACTER];
        mockLikeCounts[`${POST}/likes`] = 1;
        await expect(countPostLikes(like())).resolves.toBeUndefined();
        expect(mockStore[CHARACTER]).toBeUndefined();
        expect(mockStore[PROFILE].likesReceived).toBe(1);
    });

    it('does nothing for a deleted post', async () => {
        delete mockStore[POST];
        mockLikeCounts[`${POST}/likes`] = 1;
        await countPostLikes(like());
        expect(mockWrites).toEqual([]);
    });

    it('ignores writes that neither add nor remove a like', async () => {
        await countPostLikes(event({ createdAt: 1 }, { createdAt: 2 }));
        expect(mockDb.runTransaction).not.toHaveBeenCalled();
    });
});
