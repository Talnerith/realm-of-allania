jest.mock('firebase-admin', () => ({ firestore: jest.fn() }));
jest.mock('firebase-functions/v2/firestore', () => ({ onDocumentWritten: jest.fn((options, handler) => handler) }));

const { characterPostFields } = require('./characterSync');

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
