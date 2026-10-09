const mockFindDeps = { db: null, bucket: null };
jest.mock('firebase-admin', () => ({
    firestore: jest.fn(() => mockFindDeps.db),
    storage: jest.fn(() => ({ bucket: () => mockFindDeps.bucket }))
}));
jest.mock('firebase-functions/v2/scheduler', () => ({ onSchedule: jest.fn((options, handler) => handler) }));

const { findOrphanImages, cleanupOrphanImages, collectStrings, SCHEDULED_GRACE_MS } = require('./orphanImages');

const APP = 'artifacts/realm-of-allania-v2';
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 9);

// Fake Firestore built from { 'col/doc': data | null, 'col/doc/sub/doc': data }.
// null marks a document that only exists as the parent of a subcollection.
function fakeDb(tree) {
    const paths = Object.keys(tree);
    const childCollections = (prefix) => {
        const depth = prefix ? prefix.split('/').length + 1 : 1;
        const names = new Set(paths
            .filter((p) => (prefix ? p.startsWith(`${prefix}/`) : true))
            .map((p) => p.split('/').slice(0, depth).join('/')));
        return [...names].map(collectionRef);
    };
    function docRef(path) {
        return {
            path,
            get: async () => ({ exists: tree[path] != null, data: () => tree[path] }),
            listCollections: async () => childCollections(path)
        };
    }
    function collectionRef(path) {
        const depth = path.split('/').length + 1;
        return {
            path,
            listDocuments: async () => [...new Set(paths
                .filter((p) => p.startsWith(`${path}/`))
                .map((p) => p.split('/').slice(0, depth).join('/')))].map(docRef)
        };
    }
    return { listCollections: async () => childCollections('') };
}

function fakeBucket(names, ageDays = 30) {
    const files = names.map((name) => ({
        name,
        metadata: { timeCreated: new Date(NOW - ageDays * DAY).toISOString(), size: '1048576' },
        delete: jest.fn(async () => {})
    }));
    return { files, getFiles: async () => [files] };
}

const file = (folder, uid, name) => `${APP}/public/${folder}/${uid}/${name}`;
const url = (path) => `https://firebasestorage.googleapis.com/v0/b/b/o/${encodeURIComponent(path)}?alt=media`;

describe('collectStrings', () => {
    it('walks arrays and maps, decodes URIs and skips class instances', () => {
        const out = [];
        class Timestamp { constructor() { this.note = 'not-a-file.png'; } }
        collectStrings({ a: ['x%2Fy'], b: { c: 'z' }, t: new Timestamp(), n: 3 }, out);
        expect(out).toEqual(['x%2Fy', 'x/y', 'z', 'z']);
    });
});

describe('findOrphanImages', () => {
    const tree = {
        [`${APP}/public/data/threads/t1`]: { bannerUrl: url(file('thread_banners', 'u1', 'used-banner.jpg')) },
        [`${APP}/public/data/posts/p1`]: { content: `Look ![map](${url(file('uploads', 'u1', 'markdown.png'))})` },
        // Parent-only document: its subcollection must still be walked
        [`${APP}/users/u2`]: null,
        [`${APP}/users/u2/characters/c1`]: { imageUrl: url(file('character_portraits', 'u2', 'portrait.webp')) },
        // Logs don't keep a file, except a rejected codex edit's proposedEdit
        [`${APP}/public/data/moderation_logs/l1`]: {
            filePath: file('uploads', 'u3', 'logged-only.png'),
            proposedEdit: { gallery: [url(file('codex_gallery', 'u3', 'proposed.jpg'))] }
        },
        [`${APP}/users/u3/notifications/n1`]: { metadata: { filePath: file('uploads', 'u3', 'notified.png') } }
    };
    const names = [
        file('thread_banners', 'u1', 'used-banner.jpg'),
        file('uploads', 'u1', 'markdown.png'),
        file('character_portraits', 'u2', 'portrait.webp'),
        file('codex_gallery', 'u3', 'proposed.jpg'),
        file('uploads', 'u3', 'logged-only.png'),
        file('uploads', 'u3', 'notified.png'),
        file('uploads', 'u4', 'replaced.png'),
        `${APP}/public/region_banners/legacy.jpg`,
        'artifacts/other-app/public/uploads/u1/x.png'
    ];

    it('finds images no document mentions, ignoring logs and notifications', async () => {
        const { orphans, orphanBytes, counts } = await findOrphanImages({
            db: fakeDb(tree), bucket: fakeBucket(names), now: NOW, graceMs: 7 * DAY
        });
        expect(orphans.map((f) => f.name)).toEqual([
            file('uploads', 'u3', 'logged-only.png'),
            file('uploads', 'u3', 'notified.png'),
            file('uploads', 'u4', 'replaced.png')
        ]);
        expect(orphanBytes).toBe(3 * 1048576);
        expect(counts).toEqual({ docs: 5, files: 9, used: 4, recent: 0, legacy: 1, otherPrefix: 1 });
    });

    it('leaves files younger than the grace period', async () => {
        const { orphans, counts } = await findOrphanImages({
            db: fakeDb(tree), bucket: fakeBucket(names, 3), now: NOW, graceMs: 7 * DAY
        });
        expect(orphans).toEqual([]);
        expect(counts.recent).toBe(3);
    });

    it('refuses to judge anything when the database scan comes back empty', async () => {
        await expect(findOrphanImages({ db: fakeDb({}), bucket: fakeBucket(names), now: NOW, graceMs: DAY }))
            .rejects.toThrow('No Firestore documents found');
    });

    it('needs an explicit grace period', async () => {
        await expect(findOrphanImages({ db: fakeDb(tree), bucket: fakeBucket(names) })).rejects.toThrow('graceMs');
    });
});

describe('cleanupOrphanImages', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());

    it('deletes orphans older than a week and keeps going past a failed delete', async () => {
        expect(SCHEDULED_GRACE_MS).toBe(7 * DAY);
        const bucket = fakeBucket([file('uploads', 'u4', 'old.png'), file('uploads', 'u4', 'stuck.png')], 8);
        bucket.files[1].delete.mockRejectedValue(Object.assign(new Error('denied'), { code: 403 }));
        mockFindDeps.db = fakeDb({ [`${APP}/public/data/posts/p1`]: { content: 'No images here at all.' } });
        mockFindDeps.bucket = bucket;

        await cleanupOrphanImages();
        expect(bucket.files[0].delete).toHaveBeenCalled();
        expect(bucket.files[1].delete).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Deleted 1 of 2 orphans'));
    });

    it('keeps orphans newer than a week', async () => {
        const bucket = fakeBucket([file('uploads', 'u4', 'fresh.png')], 6);
        mockFindDeps.db = fakeDb({ [`${APP}/public/data/posts/p1`]: { content: 'No images here at all.' } });
        mockFindDeps.bucket = bucket;

        await cleanupOrphanImages();
        expect(bucket.files[0].delete).not.toHaveBeenCalled();
    });
});
