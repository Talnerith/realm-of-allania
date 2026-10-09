/**
 * Handler-level tests for moderatePost, moderateCodexPage and moderateImage
 * against an in-memory Firestore fake: AI retries and timeouts, the per-user
 * AI quota, failures landing in needs_review with a log, and the codex
 * restore / hash rules. OpenRouter is a stubbed global.fetch.
 */
const mockStore = {};        // document path -> data
const mockAdded = [];        // { path, data } from collection().add()
const mockFailingPaths = new Set(); // document paths whose get() throws

function mockSnap(path) {
    const data = mockStore[path];
    return { exists: data !== undefined, data: () => data, get: (key) => data?.[key] };
}
function mockApplyUpdate(path, update) {
    const next = { ...(mockStore[path] || {}) };
    for (const [key, value] of Object.entries(update)) {
        if (value === 'field-delete') delete next[key];
        else next[key] = value;
    }
    mockStore[path] = next;
}
function mockRef(path) {
    return {
        path,
        get: jest.fn(async () => {
            if (mockFailingPaths.has(path)) throw new Error('Firestore unavailable');
            return mockSnap(path);
        }),
        update: jest.fn(async (update) => mockApplyUpdate(path, update)),
        set: jest.fn(async (data) => { mockStore[path] = data; }),
        collection: (sub) => mockCollection(`${path}/${sub}`)
    };
}
function mockCollection(path) {
    return {
        add: jest.fn(async (data) => { mockAdded.push({ path, data }); }),
        doc: (id) => mockRef(`${path}/${id}`)
    };
}
const mockDb = {
    doc: (path) => mockRef(path),
    collection: (path) => mockCollection(path),
    runTransaction: async (fn) => fn({
        get: async (ref) => ref.get(),
        update: (ref, update) => mockApplyUpdate(ref.path, update),
        set: (ref, data) => { mockStore[ref.path] = data; }
    })
};
const mockFile = {
    getSignedUrl: jest.fn(async () => ['https://signed.example/image.png']),
    delete: jest.fn(async () => {})
};

jest.mock('firebase-admin', () => ({
    initializeApp: jest.fn(),
    firestore: jest.fn(() => mockDb),
    storage: jest.fn(() => ({ bucket: jest.fn(() => ({ file: jest.fn(() => mockFile) })) })),
    auth: jest.fn(() => ({ getUser: jest.fn(async () => { throw new Error('no auth in tests'); }) }))
}));
jest.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        serverTimestamp: jest.fn(() => 'server-timestamp'),
        delete: jest.fn(() => 'field-delete'),
        increment: jest.fn((n) => ({ increment: n }))
    },
    FieldPath: { documentId: jest.fn() }
}));
jest.mock('firebase-functions/v2/firestore', () => ({ onDocumentWritten: jest.fn((config, handler) => handler) }));
jest.mock('firebase-functions/v2/storage', () => ({ onObjectFinalized: jest.fn((config, handler) => handler) }));
jest.mock('firebase-functions/v2/scheduler', () => ({ onSchedule: jest.fn((config, handler) => handler) }));
jest.mock('firebase-functions/v2/https', () => ({
    onCall: jest.fn((options, handler) => handler),
    HttpsError: class HttpsError extends Error {
        constructor(code, message) { super(message); this.code = code; }
    }
}));
jest.mock('firebase-functions/params', () => ({ defineSecret: jest.fn(() => ({ value: jest.fn(() => 'test-api-key') })) }));
jest.mock('./threadMeta', () => ({ updateThreadMeta: jest.fn(async () => {}) }));

const {
    moderatePost, moderateCodexPage, moderateImage, consumeAiQuota, codexContentHash, codexRestoreSnapshot,
    AI_CALLS_PER_HOUR, AI_ATTEMPTS, AI_TEXT_TIMEOUT_MS, AI_IMAGE_TIMEOUT_MS
} = require('./index');

const APP = 'artifacts/realm-of-allania-v2';
const POSTS = `${APP}/public/data/posts`;
const CODEX = `${APP}/public/data/codex_pages`;
const quotaPath = (uid) => `${APP}/users/${uid}/settings/aiModeration`;
const logs = () => mockAdded.filter((a) => a.path.endsWith('/moderation_logs')).map((a) => a.data);

const originalFetch = global.fetch;
const timeoutError = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
// Each argument is one OpenRouter call: a reply string, or an Error to throw
function aiReplies(...replies) {
    global.fetch = jest.fn(async () => {
        const reply = replies.shift();
        if (reply instanceof Error) throw reply;
        return { ok: true, json: async () => ({ choices: [{ message: { content: reply } }] }) };
    });
}

function writeEvent(path, before, after, params) {
    mockStore[path] = after;
    return {
        params,
        data: { before: { data: () => before }, after: { data: () => after, ref: mockRef(path) } }
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(mockStore)) delete mockStore[key];
    mockAdded.length = 0;
    mockFailingPaths.clear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
});

describe('AI call limits', () => {
    it('keeps both attempts inside each function timeout (60s text, 90s images)', () => {
        expect(AI_ATTEMPTS).toBe(2);
        expect(AI_TEXT_TIMEOUT_MS * AI_ATTEMPTS).toBeLessThanOrEqual(45000);
        expect(AI_IMAGE_TIMEOUT_MS * AI_ATTEMPTS).toBeLessThanOrEqual(70000);
    });

    it('caps AI moderation calls per user per hour', () => {
        expect(AI_CALLS_PER_HOUR).toBe(60);
    });
});

describe('consumeAiQuota', () => {
    it('counts calls and refuses at the limit without counting', async () => {
        mockStore[quotaPath('u1')] = { windowStart: Date.now(), count: AI_CALLS_PER_HOUR - 1 };
        await expect(consumeAiQuota(mockDb, 'u1')).resolves.toBe(true);
        expect(mockStore[quotaPath('u1')].count).toBe(AI_CALLS_PER_HOUR);
        await expect(consumeAiQuota(mockDb, 'u1')).resolves.toBe(false);
        expect(mockStore[quotaPath('u1')].count).toBe(AI_CALLS_PER_HOUR);
    });

    it('starts a new window after an hour', async () => {
        mockStore[quotaPath('u1')] = { windowStart: Date.now() - 61 * 60 * 1000, count: AI_CALLS_PER_HOUR };
        await expect(consumeAiQuota(mockDb, 'u1')).resolves.toBe(true);
        expect(mockStore[quotaPath('u1')].count).toBe(1);
    });
});

describe('moderatePost', () => {
    const post = { status: 'pending', content: 'Aldric draws his sword at the gate.', userId: 'u1', threadId: 't1' };
    const run = (data = post) => moderatePost(writeEvent(`${POSTS}/p1`, undefined, data, { postId: 'p1' }));

    it('sends a timeout signal with the OpenRouter request', async () => {
        aiReplies('SAFE');
        await run();
        expect(global.fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });

    it('retries a failed AI call once and applies its verdict', async () => {
        aiReplies(timeoutError(), 'SAFE');
        await run();
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(mockStore[`${POSTS}/p1`].status).toBe('approved');
        expect(logs()).toEqual([expect.objectContaining({ type: 'post', status: 'approved', moderationMethod: 'ai-check' })]);
    });

    it('sends the post to review, with a log, when the retry fails too', async () => {
        aiReplies(timeoutError(), new Error('OpenRouter API error: 502'));
        await run();
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(mockStore[`${POSTS}/p1`]).toMatchObject({ status: 'needs_review', moderationMethod: 'auto-fallback' });
        expect(logs()).toEqual([expect.objectContaining({
            type: 'post', contentId: 'p1', status: 'needs_review', moderationMethod: 'auto-fallback', content: post.content
        })]);
    });

    it('sends the post to review, with a log, when moderation crashes before the AI step', async () => {
        mockFailingPaths.add(`${APP}/public/data/threads/t1`);
        aiReplies('SAFE');
        await run();
        expect(global.fetch).not.toHaveBeenCalled();
        expect(mockStore[`${POSTS}/p1`].status).toBe('needs_review');
        expect(logs()).toEqual([expect.objectContaining({ status: 'needs_review', moderationMethod: 'auto-fallback' })]);
    });

    it('counts the AI call against the author\'s quota', async () => {
        aiReplies('SAFE');
        await run();
        expect(mockStore[quotaPath('u1')].count).toBe(1);
    });

    it('skips the AI over the hourly quota and leaves the post for a moderator', async () => {
        mockStore[quotaPath('u1')] = { windowStart: Date.now(), count: AI_CALLS_PER_HOUR };
        aiReplies('SAFE');
        await run();
        expect(global.fetch).not.toHaveBeenCalled();
        expect(mockStore[`${POSTS}/p1`]).toMatchObject({ status: 'needs_review', moderationMethod: 'rate-limit' });
        expect(logs()).toEqual([expect.objectContaining({ status: 'needs_review', moderationMethod: 'rate-limit' })]);
    });

    it('lets trusted users skip the AI (and the quota)', async () => {
        mockStore[`${APP}/users/u1/settings/account`] = { role: 'trusted' };
        mockStore[quotaPath('u1')] = { windowStart: Date.now(), count: AI_CALLS_PER_HOUR };
        aiReplies('SAFE');
        await run();
        expect(global.fetch).not.toHaveBeenCalled();
        expect(mockStore[`${POSTS}/p1`].status).toBe('approved');
    });
});

describe('moderateCodexPage', () => {
    const approvedLive = {
        status: 'approved', title: 'Emberfall Keep', category: 'Locations', tags: ['Fortress'],
        content: 'Moderator-approved text about the keep.', creatorId: 'u1', lastEditorId: 'u1',
        // Stale: a moderator approved the current text from the dashboard,
        // which doesn't refresh the snapshot
        approvedSnapshot: { title: 'Emberfall Keep', category: 'Locations', content: 'Original text v1 about the keep.' }
    };
    const edit = (previous, changes) => ({ ...previous, status: 'pending', lastEditorId: 'u2', ...changes });
    const run = (before, after) => moderateCodexPage(writeEvent(`${CODEX}/k1`, before, after, { pageId: 'k1' }));
    const aiUserText = () => JSON.parse(global.fetch.mock.calls[0][1].body).messages[1].content;

    it('restores the version a moderator approved, not an older snapshot, when an edit is rejected', async () => {
        const after = edit(approvedLive, { content: 'Vandalised text about the keep.' });
        aiReplies('REJECT: vandalism');
        await run(approvedLive, after);

        const page = mockStore[`${CODEX}/k1`];
        expect(page.status).toBe('approved');
        expect(page.content).toBe('Moderator-approved text about the keep.');
        expect(page.approvedSnapshot.content).toBe('Moderator-approved text about the keep.');
        expect(logs()[0]).toMatchObject({
            status: 'rejected', restoredPreviousVersion: true,
            proposedEdit: expect.objectContaining({ content: 'Vandalised text about the keep.' })
        });
    });

    it('falls back to the stored snapshot when the edit replaced an unapproved version', () => {
        const rejected = { ...approvedLive, status: 'rejected', content: 'Rejected text' };
        expect(codexRestoreSnapshot(edit(rejected, {}), rejected)).toBe(approvedLive.approvedSnapshot);
        expect(codexRestoreSnapshot({ status: 'pending' }, undefined)).toBeNull();
    });

    it('keeps the page live and logs for review when the AI fails twice', async () => {
        const after = edit(approvedLive, { content: 'A long new history of the keep.' });
        aiReplies(timeoutError(), timeoutError());
        await run(approvedLive, after);

        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(mockStore[`${CODEX}/k1`]).toMatchObject({ status: 'approved', content: approvedLive.content });
        expect(logs()[0]).toMatchObject({ status: 'needs_review', moderationMethod: 'auto-fallback', restoredPreviousVersion: true });
    });

    it('moderates a category-only change, with the category in the AI text', async () => {
        const pending = edit(approvedLive, {});
        const after = { ...pending, category: 'Taverns of Ill Repute' };
        aiReplies('SAFE');
        await run(pending, after);

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(aiUserText()).toContain('Category: Taverns of Ill Repute');
        expect(mockStore[`${CODEX}/k1`].status).toBe('approved');
    });

    it('runs the keyword filter on the category', async () => {
        const after = edit(approvedLive, { category: 'Free Money' });
        aiReplies('SAFE');
        await run(approvedLive, after);

        expect(global.fetch).not.toHaveBeenCalled();
        expect(logs()[0]).toMatchObject({ status: 'rejected', moderationMethod: 'auto-regex' });
    });

    it('ignores a pending write that changes nothing moderated', async () => {
        const pending = edit(approvedLive, {});
        aiReplies('SAFE');
        await run(pending, { ...pending, views: 3 });
        expect(global.fetch).not.toHaveBeenCalled();
        expect(logs()).toEqual([]);
    });

    it('logs a hash covering title, tags, category and content', async () => {
        const after = edit(approvedLive, { content: 'Some brand new lore.' });
        aiReplies('REJECT: off-topic');
        await run(approvedLive, after);

        expect(logs()[0].contentHash).toBe(codexContentHash(after));
        expect(logs()[0]).toMatchObject({ category: 'Locations', tags: ['Fortress'] });
        for (const change of [{ title: 'Other' }, { tags: ['Ruin'] }, { category: 'Lore' }, { content: 'Other text.' }]) {
            expect(codexContentHash({ ...after, ...change })).not.toBe(codexContentHash(after));
        }
    });

    it('skips the AI over the editor\'s hourly quota', async () => {
        mockStore[quotaPath('u2')] = { windowStart: Date.now(), count: AI_CALLS_PER_HOUR };
        aiReplies('SAFE');
        await run(approvedLive, edit(approvedLive, { content: 'Over-quota edit of the keep.' }));
        expect(global.fetch).not.toHaveBeenCalled();
        expect(logs()[0]).toMatchObject({ status: 'needs_review', moderationMethod: 'rate-limit' });
    });
});

describe('moderateImage', () => {
    const run = () => moderateImage({
        data: { name: `${APP}/public/character_portraits/u1/a.png`, bucket: 'bucket', contentType: 'image/png' }
    });

    it('sends a timeout signal with the OpenRouter request', async () => {
        aiReplies('SAFE');
        await run();
        expect(global.fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
        expect(logs()).toEqual([expect.objectContaining({ type: 'image', status: 'approved' })]);
    });

    it('retries once before giving up', async () => {
        aiReplies(timeoutError(), 'UNSAFE: gore');
        await run();
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(mockFile.delete).toHaveBeenCalled();
        expect(logs()[0]).toMatchObject({ status: 'rejected' });
    });

    it('keeps the image and logs needs_review when both attempts fail', async () => {
        aiReplies(timeoutError(), timeoutError());
        await run();
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(mockFile.delete).not.toHaveBeenCalled();
        expect(logs()).toEqual([expect.objectContaining({ status: 'needs_review', moderationMethod: 'auto-fallback' })]);
    });

    it('keeps the image and logs needs_review over the uploader\'s quota', async () => {
        mockStore[quotaPath('u1')] = { windowStart: Date.now(), count: AI_CALLS_PER_HOUR };
        aiReplies('SAFE');
        await run();
        expect(global.fetch).not.toHaveBeenCalled();
        expect(mockFile.delete).not.toHaveBeenCalled();
        expect(logs()).toEqual([expect.objectContaining({ status: 'needs_review', moderationMethod: 'rate-limit' })]);
    });
});
