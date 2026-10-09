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

const https = require('https');
const { EventEmitter } = require('events');
const { isBlockedAddress, parseImageUrl, fetchImage } = require('./importImage');

describe('isBlockedAddress', () => {
    it.each([
        '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1',
        '169.254.169.254', // GCP metadata server
        '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
        '::1', '::', 'fd00::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1',
        '0:0:0:0:0:0:0:1', 'fe80::1%eth0', 'fec0::1',
        // IPv4-mapped / translated / compatible, in the hex form URL parsing produces
        '::ffff:a9fe:a9fe', '::ffff:7f00:1', '::ffff:0:a9fe:a9fe', '::7f00:1', '::127.0.0.1',
        'fd20:ce::254', 'fd00:ec2::254', // GCP / AWS IPv6 metadata servers
        '2002:a9fe:a9fe::1', '2002:7f00:1::', // 6to4 wrapping private IPv4
        '64:ff9b::a9fe:a9fe', '64:ff9b:1::1', '2001::1', '2001:db8::1', '100::1',
        'not-an-ip'
    ])('blocks %s', (address) => {
        expect(isBlockedAddress(address)).toBe(true);
    });

    it.each([
        '8.8.8.8', '151.101.1.69', '172.32.0.1', '2606:4700::1111', '::ffff:8.8.8.8',
        '::ffff:808:808', '2002:808:808::1', '2a00:1450:4001:80b::200e'
    ])('allows public %s', (address) => {
        expect(isBlockedAddress(address)).toBe(false);
    });
});

describe('parseImageUrl with IP literals', () => {
    it.each([
        'https://[::1]/a.png',
        'https://[::ffff:169.254.169.254]/a.png', // becomes [::ffff:a9fe:a9fe]
        'https://[::ffff:a9fe:a9fe]/computeMetadata/v1/',
        'https://[0:0:0:0:0:ffff:7f00:1]/a.png',
        'https://[fd20:ce::254]/a.png',
        'https://[fe80::1]/a.png',
        'https://0x7f.1/a.png', // normalised to 127.0.0.1
        'https://2852039166/a.png' // 169.254.169.254 as a number
    ])('rejects %s', (url) => {
        expect(() => parseImageUrl(url)).toThrow('That address is not allowed.');
    });

    it('accepts a public IPv6 literal', () => {
        expect(parseImageUrl('https://[2606:4700::1111]/a.png').hostname).toBe('[2606:4700::1111]');
    });
});

describe('fetchImage redirects', () => {
    afterEach(() => jest.restoreAllMocks());

    // A fake https.get whose response redirects to `location`
    const redirectTo = (location) => jest.spyOn(https, 'get').mockImplementation((url, options, onResponse) => {
        const req = new EventEmitter();
        req.destroy = jest.fn();
        const res = Object.assign(new EventEmitter(), { statusCode: 302, headers: { location }, resume: jest.fn() });
        process.nextTick(() => onResponse(res));
        return req;
    });

    it.each([
        ['https://[::ffff:a9fe:a9fe]/computeMetadata/v1/', 'That address is not allowed.'],
        ['https://[::1]/a.png', 'That address is not allowed.'],
        ['https://169.254.169.254/latest/meta-data/', 'That address is not allowed.'],
        ['http://example.org/a.png', 'Only https:// image links are supported.']
    ])('refuses a redirect to %s without fetching it', async (location, message) => {
        const get = redirectTo(location);
        await expect(fetchImage('https://example.com/a.png')).rejects.toThrow(message);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it('gives up after a few redirects', async () => {
        const get = redirectTo('https://example.com/again.png');
        await expect(fetchImage('https://example.com/a.png')).rejects.toThrow('Too many redirects.');
        expect(get).toHaveBeenCalledTimes(4);
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
