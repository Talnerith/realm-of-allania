jest.mock('firebase-admin', () => ({ firestore: jest.fn(), storage: jest.fn() }));
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: jest.fn() } }));
jest.mock('firebase-functions/v2/https', () => ({
    onCall: jest.fn((options, handler) => handler),
    HttpsError: class HttpsError extends Error {
        constructor(code, message) { super(message); this.code = code; }
    }
}));

const { findExternalImages, rewriteFields, isExternalImageUrl, importAndRewrite } = require('./imageMigration');
// Captured before any clearAllMocks: the options each callable was defined with
const callableOptions = require('firebase-functions/v2/https').onCall.mock.calls.map(([options]) => options);

describe('callable options', () => {
    it('require App Check', () => {
        expect(callableOptions).toHaveLength(2); // imports importImage too
        callableOptions.forEach((options) => expect(options.enforceAppCheck).toBe(true));
    });
});

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

describe('importAndRewrite', () => {
    const ext = (name) => `https://ex.com/${name}`;
    const stored = (name) => `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${name}`;

    // Fake Firestore: documents by path, with every call recorded in order
    function setup(docs) {
        const events = [];
        const db = {
            doc: (path) => ({
                get: async () => ({ exists: path in docs, data: () => docs[path] }),
                update: async (update) => {
                    events.push(`update ${path}`);
                    docs[path] = { ...docs[path], ...update };
                }
            })
        };
        const importImage = jest.fn(async (img) => {
            events.push(`import ${img.url}`);
            if (img.url.includes('dead')) throw new Error('404');
            return stored(img.url.split('/').pop());
        });
        return { db, events, importImage };
    }
    const imagesFor = (refs) => new Map(refs.map((r) => [r.url, { url: r.url, folder: r.folder, owner: r.owner }]));

    it('rewrites each document as soon as its images are imported', async () => {
        const docs = {
            't/1': { bannerUrl: ext('a.jpg') },
            't/2': { bannerUrl: ext('b.jpg') }
        };
        const refs = [
            { path: 't/1', field: 'bannerUrl', url: ext('a.jpg'), folder: 'thread_banners', owner: 'u1' },
            { path: 't/2', field: 'bannerUrl', url: ext('b.jpg'), folder: 'thread_banners', owner: 'u2' }
        ];
        const { db, events, importImage } = setup(docs);
        const result = await importAndRewrite({ db, refs, images: imagesFor(refs), importImage });

        expect(events).toEqual([`import ${ext('a.jpg')}`, 'update t/1', `import ${ext('b.jpg')}`, 'update t/2']);
        expect(docs['t/1'].bannerUrl).toBe(stored('a.jpg'));
        expect(result).toEqual({ imported: 2, failed: [], documentsUpdated: 2, documentsRemaining: 0 });
    });

    it('imports a shared image once and reports failures', async () => {
        const docs = {
            'p/1': { content: `![x](${ext('a.jpg')}) ![y](${ext('dead.jpg')})` },
            'p/2': { content: `![x](${ext('a.jpg')})` }
        };
        const refs = [
            { path: 'p/1', field: 'content', url: ext('a.jpg'), folder: 'uploads', owner: 'u1' },
            { path: 'p/1', field: 'content', url: ext('dead.jpg'), folder: 'uploads', owner: 'u1' },
            { path: 'p/2', field: 'content', url: ext('a.jpg'), folder: 'uploads', owner: 'u2' }
        ];
        const { db, importImage } = setup(docs);
        const result = await importAndRewrite({ db, refs, images: imagesFor(refs), importImage });

        expect(importImage).toHaveBeenCalledTimes(2);
        expect(docs['p/1'].content).toBe(`![x](${stored('a.jpg')}) ![y](${ext('dead.jpg')})`);
        expect(docs['p/2'].content).toBe(`![x](${stored('a.jpg')})`);
        expect(result.failed).toEqual([{ url: ext('dead.jpg'), error: '404' }]);
    });

    it('stops at the deadline, keeping what is done for the next run', async () => {
        const docs = { 't/1': { bannerUrl: ext('a.jpg') }, 't/2': { bannerUrl: ext('b.jpg') } };
        const refs = [
            { path: 't/1', field: 'bannerUrl', url: ext('a.jpg'), folder: 'thread_banners', owner: 'u1' },
            { path: 't/2', field: 'bannerUrl', url: ext('b.jpg'), folder: 'thread_banners', owner: 'u2' }
        ];
        const { db, importImage } = setup(docs);
        let clock = 0;
        const now = () => clock;
        importImage.mockImplementation(async (img) => { clock += 100; return stored(img.url.split('/').pop()); });
        const result = await importAndRewrite({ db, refs, images: imagesFor(refs), importImage, deadline: 50, now });

        expect(docs['t/1'].bannerUrl).toBe(stored('a.jpg'));
        expect(docs['t/2'].bannerUrl).toBe(ext('b.jpg'));
        expect(result).toMatchObject({ imported: 1, documentsUpdated: 1, documentsRemaining: 1 });
    });

    it('skips documents deleted or changed since the scan', async () => {
        const docs = { 't/2': { bannerUrl: 'https://firebasestorage.googleapis.com/new.jpg' } };
        const refs = [
            { path: 't/1', field: 'bannerUrl', url: ext('a.jpg'), folder: 'thread_banners', owner: 'u1' },
            { path: 't/2', field: 'bannerUrl', url: ext('b.jpg'), folder: 'thread_banners', owner: 'u2' }
        ];
        const { db, events, importImage } = setup(docs);
        const result = await importAndRewrite({ db, refs, images: imagesFor(refs), importImage });

        expect(events.filter((e) => e.startsWith('update'))).toEqual([]);
        expect(result.documentsUpdated).toBe(0);
    });
});
