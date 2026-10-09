// Fake Firestore: each query returns the docs listed for its two filters
const mockQueryResults = {};
const mockWrites = [];
const mockDocs = (paths) => {
    const docs = paths.map((path) => ({ ref: { path }, get: () => undefined }));
    return { size: docs.length, forEach: (fn) => docs.forEach(fn) };
};
const mockCollection = (path, filters = []) => ({
    where: (field, op, value) => mockCollection(path, [...filters, `${field}==${value}`]),
    get: async () => mockDocs(mockQueryResults[`${path.split('/').pop()}?${filters.join('&')}`] || [])
});
const mockDb = {
    collection: (path) => mockCollection(path),
    bulkWriter: () => ({
        update: (ref, fields) => mockWrites.push({ path: ref.path, fields }),
        close: async () => {}
    })
};
jest.mock('firebase-admin', () => ({ firestore: jest.fn(() => mockDb) }));
jest.mock('firebase-functions/v2/firestore', () => ({ onDocumentWritten: jest.fn((options, handler) => handler) }));

const { characterPostFields, syncCharacter } = require('./characterSync');

describe('characterPostFields', () => {
    const before = { name: 'Aldric', race: 'Human', class: 'Knight', imageUrl: 'a.jpg', imagePosition: 'center', description: 'Old' };

    it('marks posts of a deleted character and clears the portrait', () => {
        expect(characterPostFields(before, undefined)).toEqual({
            characterName: 'Aldric [Deleted]', characterImageUrl: '', characterImagePosition: 'center'
        });
    });

    it('copies every displayed field after a rename', () => {
        expect(characterPostFields(before, { ...before, name: 'Aldric the Bold' })).toEqual({
            characterName: 'Aldric the Bold', characterRace: 'Human', characterClass: 'Knight',
            characterImageUrl: 'a.jpg', characterImagePosition: 'center'
        });
    });

    it('also syncs race, class and portrait changes', () => {
        expect(characterPostFields(before, { ...before, class: 'Paladin' }).characterClass).toBe('Paladin');
        expect(characterPostFields(before, { ...before, imageUrl: 'b.jpg' }).characterImageUrl).toBe('b.jpg');
    });

    it('does nothing when only fields posts never show changed', () => {
        expect(characterPostFields(before, { ...before, description: 'New backstory' })).toBeNull();
    });
});

describe('syncCharacter', () => {
    const before = { name: 'Aldric', race: 'Human', class: 'Knight', imageUrl: 'a.jpg' };
    const run = (after) => syncCharacter({
        params: { userId: 'u1', charId: 'c1' },
        data: { before: { data: () => before }, after: { data: () => after } }
    });

    beforeEach(() => {
        mockWrites.length = 0;
        for (const k of Object.keys(mockQueryResults)) delete mockQueryResults[k];
        mockQueryResults['posts?userId==u1&characterId==c1'] = ['posts/p1'];
        mockQueryResults['threads?creatorId==u1&characterId==c1'] = ['threads/t1'];
        mockQueryResults['threads?lastPostUserId==u1&lastPostCharacterId==c1'] = ['threads/t1', 'threads/t2'];
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());

    it('renames the character in "last post by" too, one write per thread', async () => {
        await run({ ...before, name: 'Aldric the Bold' });
        expect(mockWrites).toEqual([
            { path: 'posts/p1', fields: expect.objectContaining({ characterName: 'Aldric the Bold' }) },
            { path: 'threads/t1', fields: { createdBy: 'Aldric the Bold', lastPostBy: 'Aldric the Bold' } },
            { path: 'threads/t2', fields: { lastPostBy: 'Aldric the Bold' } }
        ]);
    });

    it('marks a deleted character in "last post by"', async () => {
        await run(undefined);
        expect(mockWrites).toContainEqual({ path: 'threads/t2', fields: { lastPostBy: 'Aldric [Deleted]' } });
    });
});
