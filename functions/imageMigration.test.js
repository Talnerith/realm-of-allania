jest.mock('firebase-admin', () => ({ firestore: jest.fn(), storage: jest.fn() }));
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: jest.fn() } }));
jest.mock('firebase-functions/v2/https', () => ({
    onCall: jest.fn((options, handler) => handler),
    HttpsError: class HttpsError extends Error {
        constructor(code, message) { super(message); this.code = code; }
    }
}));

const { findExternalImages, rewriteFields, isExternalImageUrl } = require('./imageMigration');

const BUCKET = 'realm.firebasestorage.app';
const hosted = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/a.jpg?alt=media`;

describe('isExternalImageUrl', () => {
    it('flags outside hosts and other buckets, not our Storage or empty values', () => {
        expect(isExternalImageUrl('https://i.imgur.com/tavern.jpg', BUCKET)).toBe(true);
        expect(isExternalImageUrl('https://firebasestorage.googleapis.com/v0/b/other/o/x.jpg', BUCKET)).toBe(true);
        expect(isExternalImageUrl(hosted, BUCKET)).toBe(false);
        expect(isExternalImageUrl('', BUCKET)).toBe(false);
        expect(isExternalImageUrl('/map.webp', BUCKET)).toBe(false);
    });
});

describe('findExternalImages', () => {
    const docs = [
        { path: 'p/threads/t1', kind: 'thread', owner: 'u1', data: { bannerUrl: 'https://ex.com/tavern.jpg' } },
        { path: 'p/threads/t2', kind: 'thread', owner: 'u2', data: { bannerUrl: hosted } },
        { path: 'artifacts/a/users/u1/characters/c1', kind: 'character', owner: 'u1', data: { imageUrl: 'https://ex.com/corian.png' } },
        { path: 'p/posts/x', kind: 'post', owner: 'u1', data: { characterImageUrl: 'https://ex.com/corian.png', content: 'Hi ![map](https://ex.com/m.png) there' } },
        { path: 'p/codex_pages/k', kind: 'codex', owner: 'u3', data: { imageUrl: '', gallery: ['https://ex.com/g1.jpg', hosted], content: 'x', approvedSnapshot: { gallery: ['https://ex.com/g1.jpg'] } } }
    ];

    it('finds banners, portraits, gallery items, markdown images and snapshot copies', () => {
        const refs = findExternalImages(docs, BUCKET);
        expect(refs.map((r) => `${r.path}:${r.field}:${r.folder}`)).toEqual([
            'p/threads/t1:bannerUrl:thread_banners',
            'artifacts/a/users/u1/characters/c1:imageUrl:character_portraits',
            'p/posts/x:characterImageUrl:character_portraits',
            'p/posts/x:content:uploads',
            'p/codex_pages/k:gallery:codex_gallery',
            'p/codex_pages/k:approvedSnapshot.gallery:codex_gallery'
        ]);
        expect(refs[0].owner).toBe('u1');
    });
});

describe('rewriteFields', () => {
    const mapping = new Map([
        ['https://ex.com/corian.png', hosted],
        ['https://ex.com/m.png', 'https://firebasestorage.googleapis.com/v0/b/b/o/m.png']
    ]);

    it('swaps imported URLs in plain fields, arrays and markdown', () => {
        const data = {
            characterImageUrl: 'https://ex.com/corian.png',
            content: 'Hi ![map](https://ex.com/m.png) and ![x](https://ex.com/dead.png)',
            gallery: ['https://ex.com/corian.png', 'keep'],
            approvedSnapshot: { gallery: ['https://ex.com/corian.png'] }
        };
        expect(rewriteFields(data, ['characterImageUrl', 'content', 'gallery', 'approvedSnapshot.gallery'], mapping)).toEqual({
            characterImageUrl: hosted,
            content: 'Hi ![map](https://firebasestorage.googleapis.com/v0/b/b/o/m.png) and ![x](https://ex.com/dead.png)',
            gallery: [hosted, 'keep'],
            'approvedSnapshot.gallery': [hosted]
        });
    });

    it('leaves out fields whose images failed to import', () => {
        expect(rewriteFields({ bannerUrl: 'https://ex.com/dead.jpg' }, ['bannerUrl'], mapping)).toEqual({});
    });
});
