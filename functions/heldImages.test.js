/**
 * Held images: hiding a file sets its download token aside, approving puts
 * the same token back (so saved URLs work again), rejecting deletes the file.
 */
const mockAdded = [];
const mockFile = {
    getMetadata: jest.fn(),
    setMetadata: jest.fn(async () => {}),
    delete: jest.fn(async () => {})
};

jest.mock('firebase-admin', () => ({
    firestore: jest.fn(() => ({
        collection: (path) => ({
            doc: (id) => ({
                collection: (sub) => ({ add: jest.fn(async (data) => { mockAdded.push({ path: `${path}/${id}/${sub}`, data }); }) })
            })
        })
    })),
    storage: jest.fn(() => ({ bucket: jest.fn(() => ({ file: jest.fn(() => mockFile) })) }))
}));
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: jest.fn(() => 'now') } }));
jest.mock('firebase-functions/v2/firestore', () => ({ onDocumentUpdated: jest.fn((config, handler) => handler) }));

const { holdImage, releaseImage, handleImageReview } = require('./heldImages');

const custom = (metadata) => mockFile.getMetadata.mockResolvedValue([{ metadata }]);
const review = (before, after) => handleImageReview({
    data: { before: { data: () => before }, after: { data: () => after } }
});
const ENTRY = { type: 'image', filePath: 'artifacts/realm-of-allania-v2/public/character_portraits/u1/a.png', userId: 'u1' };

beforeEach(() => {
    jest.clearAllMocks();
    mockAdded.length = 0;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('holdImage / releaseImage', () => {
    it('sets the download token aside and marks the file held', async () => {
        custom({ firebaseStorageDownloadTokens: 'tok-1' });
        await holdImage(mockFile);
        expect(mockFile.setMetadata).toHaveBeenCalledWith({
            metadata: { firebaseStorageDownloadTokens: null, heldDownloadTokens: 'tok-1', moderation: 'held' }
        });
    });

    it('does nothing to a file that is already held', async () => {
        custom({ moderation: 'held', heldDownloadTokens: 'tok-1' });
        await holdImage(mockFile);
        expect(mockFile.setMetadata).not.toHaveBeenCalled();
    });

    it('puts the same token back on release, so saved URLs work again', async () => {
        custom({ moderation: 'held', heldDownloadTokens: 'tok-1' });
        await releaseImage(mockFile);
        expect(mockFile.setMetadata).toHaveBeenCalledWith({
            metadata: { firebaseStorageDownloadTokens: 'tok-1', heldDownloadTokens: null, moderation: null }
        });
    });

    it('leaves a file that was never held alone', async () => {
        custom({ firebaseStorageDownloadTokens: 'tok-1' });
        await releaseImage(mockFile);
        expect(mockFile.setMetadata).not.toHaveBeenCalled();
    });
});

describe('handleImageReview', () => {
    it('a moderator approving a held image releases it and tells the uploader', async () => {
        custom({ moderation: 'held', heldDownloadTokens: 'tok-1' });
        await review({ ...ENTRY, status: 'needs_review' }, { ...ENTRY, status: 'approved' });
        expect(mockFile.setMetadata).toHaveBeenCalled();
        expect(mockFile.delete).not.toHaveBeenCalled();
        expect(mockAdded).toEqual([expect.objectContaining({ data: expect.objectContaining({ type: 'image_approved' }) })]);
    });

    it('a moderator rejecting an image deletes it and tells the uploader', async () => {
        await review({ ...ENTRY, status: 'needs_review' }, { ...ENTRY, status: 'rejected' });
        expect(mockFile.delete).toHaveBeenCalledWith({ ignoreNotFound: true });
        expect(mockAdded).toEqual([expect.objectContaining({ data: expect.objectContaining({ type: 'image_rejected' }) })]);
    });

    it('ignores other entries and updates that keep the status', async () => {
        await review({ type: 'post', status: 'needs_review' }, { type: 'post', status: 'approved' });
        await review({ ...ENTRY, status: 'approved' }, { ...ENTRY, status: 'approved', moderatedBy: 'm1' });
        expect(mockFile.getMetadata).not.toHaveBeenCalled();
        expect(mockFile.delete).not.toHaveBeenCalled();
    });
});
