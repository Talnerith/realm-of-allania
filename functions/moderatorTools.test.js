jest.mock('firebase-admin', () => ({ firestore: jest.fn(), storage: jest.fn() }));
jest.mock('firebase-functions/v2/https', () => ({
    onCall: jest.fn((options, handler) => handler),
    HttpsError: class HttpsError extends Error {
        constructor(code, message) { super(message); this.code = code; }
    }
}));

const { isDeletableImagePath } = require('./moderatorTools');

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
