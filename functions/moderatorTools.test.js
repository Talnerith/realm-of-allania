const mockRoles = {};      // uid -> role
const mockLogs = [];
const mockDelete = jest.fn(async () => {});

jest.mock('firebase-admin', () => ({
    firestore: jest.fn(() => ({
        doc: (path) => ({
            get: async () => {
                const uid = path.split('/')[3];
                return { exists: uid in mockRoles, data: () => ({ role: mockRoles[uid] }) };
            }
        }),
        collection: (path) => ({ add: async (data) => mockLogs.push({ path, data }) })
    })),
    storage: jest.fn(() => ({ bucket: () => ({ file: () => ({ delete: mockDelete }) }) }))
}));
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'now' } }));
jest.mock('firebase-functions/v2/https', () => ({
    onCall: jest.fn((options, handler) => handler),
    HttpsError: class HttpsError extends Error {
        constructor(code, message) { super(message); this.code = code; }
    }
}));

const { isDeletableImagePath, imageOwner, canDeleteImage, deleteUserImage } = require('./moderatorTools');

const file = (folder, uid) => `artifacts/realm-of-allania-v2/public/${folder}/${uid}/pic.jpg`;

describe('isDeletableImagePath', () => {
    it('allows files in the public upload area', () => {
        expect(isDeletableImagePath('artifacts/realm-of-allania-v2/public/character_portraits/uid1/a.jpg')).toBe(true);
    });

    it.each([
        ['outside the public area', 'artifacts/realm-of-allania-v2/private/x.jpg'],
        ['another app', 'artifacts/other-app/public/x.jpg'],
        ['path traversal', 'artifacts/realm-of-allania-v2/public/../../secrets.json'],
        ['empty segments', 'artifacts/realm-of-allania-v2/public//x.jpg'],
        ['not a string', 42]
    ])('refuses %s', (_, path) => {
        expect(isDeletableImagePath(path)).toBe(false);
    });
});

describe('imageOwner', () => {
    it('reads the uploader from a player folder, null for legacy paths', () => {
        expect(imageOwner(file('uploads', 'u9'))).toBe('u9');
        expect(imageOwner('artifacts/realm-of-allania-v2/public/region_banners/old.jpg')).toBeNull();
    });
});

describe('canDeleteImage', () => {
    it.each([
        ['admin, any file', { role: 'admin', callerUid: 'a', ownerUid: 'm2', ownerRole: 'admin' }, true],
        ['admin, legacy file', { role: 'admin', callerUid: 'a', ownerUid: null }, true],
        ['moderator, player file', { role: 'moderator', callerUid: 'm', ownerUid: 'p', ownerRole: 'user' }, true],
        ['moderator, own file', { role: 'moderator', callerUid: 'm', ownerUid: 'm', ownerRole: null }, true],
        ['moderator, admin file', { role: 'moderator', callerUid: 'm', ownerUid: 'a', ownerRole: 'admin' }, false],
        ['moderator, other moderator file', { role: 'moderator', callerUid: 'm', ownerUid: 'm2', ownerRole: 'moderator' }, false],
        ['moderator, legacy file', { role: 'moderator', callerUid: 'm', ownerUid: null }, false],
        ['player', { role: 'user', callerUid: 'p', ownerUid: 'p', ownerRole: null }, false]
    ])('%s', (_, args, expected) => {
        expect(canDeleteImage(args)).toBe(expected);
    });
});

describe('deleteUserImage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        for (const k of Object.keys(mockRoles)) delete mockRoles[k];
        mockLogs.length = 0;
        Object.assign(mockRoles, { mod1: 'moderator', mod2: 'moderator', admin1: 'admin', player1: 'user' });
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());

    const call = (uid, filePath) => deleteUserImage({ auth: { uid }, data: { filePath } });

    it('lets a moderator delete a player\'s image and logs it', async () => {
        await expect(call('mod1', file('character_portraits', 'player1'))).resolves.toEqual({ deleted: true });
        expect(mockDelete).toHaveBeenCalled();
        expect(mockLogs).toEqual([{
            path: 'artifacts/realm-of-allania-v2/public/data/moderation_logs',
            data: expect.objectContaining({
                type: 'image_deletion', filePath: file('character_portraits', 'player1'),
                userId: 'player1', deletedBy: 'mod1', deletedByRole: 'moderator', status: 'deleted'
            })
        }]);
    });

    it.each([
        ['an admin\'s', file('region_banners', 'admin1')],
        ['another moderator\'s', file('uploads', 'mod2')],
        ['a legacy', 'artifacts/realm-of-allania-v2/public/region_banners/old.jpg']
    ])('refuses a moderator deleting %s file, without deleting or logging', async (_, path) => {
        await expect(call('mod1', path)).rejects.toMatchObject({ code: 'permission-denied' });
        expect(mockDelete).not.toHaveBeenCalled();
        expect(mockLogs).toEqual([]);
    });

    it('lets an admin delete a moderator\'s file', async () => {
        await expect(call('admin1', file('region_banners', 'mod2'))).resolves.toEqual({ deleted: true });
        expect(mockLogs[0].data).toMatchObject({ deletedBy: 'admin1', ownerRole: 'moderator' });
    });

    it('refuses players', async () => {
        await expect(call('player1', file('uploads', 'player1'))).rejects.toMatchObject({ code: 'permission-denied' });
    });
});
