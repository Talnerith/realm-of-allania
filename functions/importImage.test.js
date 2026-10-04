/**
 * Tests for the image import callable's URL and address safety checks
 * (the network fetch itself is not exercised here).
 */
jest.mock('firebase-functions/v2/https', () => ({
    onCall: jest.fn((options, handler) => handler),
    HttpsError: class HttpsError extends Error {
        constructor(code, message) { super(message); this.code = code; }
    }
}));
jest.mock('firebase-admin', () => ({ firestore: jest.fn(), storage: jest.fn() }));
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: jest.fn() } }));

const { isBlockedAddress, parseImageUrl } = require('./importImage');

describe('isBlockedAddress', () => {
    it.each([
        '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1',
        '169.254.169.254', // GCP metadata server
        '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
        '::1', '::', 'fd00::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1',
        'not-an-ip'
    ])('blocks %s', (address) => {
        expect(isBlockedAddress(address)).toBe(true);
    });

    it.each(['8.8.8.8', '151.101.1.69', '172.32.0.1', '2606:4700::1111', '::ffff:8.8.8.8'])('allows public %s', (address) => {
        expect(isBlockedAddress(address)).toBe(false);
    });
});

describe('parseImageUrl', () => {
    it('accepts a normal https image link', () => {
        expect(parseImageUrl('https://example.com/dragon.png').hostname).toBe('example.com');
    });

    it.each([
        ['http (not https)', 'http://example.com/a.png'],
        ['credentials in the URL', 'https://user:pass@example.com/a.png'],
        ['a non-standard port', 'https://example.com:8443/a.png'],
        ['a private IP literal', 'https://192.168.0.10/a.png'],
        ['the metadata server', 'https://169.254.169.254/computeMetadata/v1/'],
        ['a file URL', 'file:///etc/passwd'],
        ['garbage', 'not a url']
    ])('rejects %s', (_, url) => {
        expect(() => parseImageUrl(url)).toThrow();
    });
});
