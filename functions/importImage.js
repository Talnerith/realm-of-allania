// Copies an image from a pasted URL into the user's Storage folder, so it goes
// through image moderation (moderateImage runs on the upload) and the site only
// ever serves images it hosts: no unmoderated hotlinks, no viewer IPs leaking
// to third-party hosts, and the picture can't be swapped after approval.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const crypto = require("crypto");
const dns = require("dns");
const https = require("https");
const net = require("net");

const APP_ID = 'realm-of-allania-v2';
const MAX_BYTES = 5 * 1024 * 1024; // same cap as storage.rules
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 10000;
const IMPORTS_PER_HOUR = 20;
// Upload folders used by ImageUploader
const ALLOWED_FOLDERS = ['character_portraits', 'codex_gallery', 'region_banners', 'thread_banners', 'uploads'];

const IMAGE_TYPES = {
    'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    'image/png': { ext: 'png', magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
    'image/gif': { ext: 'gif', magic: (b) => b.subarray(0, 4).toString('latin1') === 'GIF8' },
    'image/webp': { ext: 'webp', magic: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' }
};

// True for addresses a server-side fetch must never reach: loopback, private
// networks, link-local (incl. the 169.254.169.254 metadata server), CGNAT,
// multicast/reserved, and their IPv6 / IPv4-mapped equivalents.
function isBlockedAddress(address) {
    if (net.isIPv4(address)) {
        const [a, b] = address.split('.').map(Number);
        return a === 0 || a === 10 || a === 127 || a >= 224
            || (a === 100 && b >= 64 && b <= 127)
            || (a === 169 && b === 254)
            || (a === 172 && b >= 16 && b <= 31)
            || (a === 192 && b === 168)
            || (a === 192 && b === 0)
            || (a === 198 && (b === 18 || b === 19));
    }
    if (net.isIPv6(address)) {
        const lower = address.toLowerCase();
        const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (mapped) return isBlockedAddress(mapped[1]);
        return lower === '::' || lower === '::1'
            || /^f[cd]/.test(lower)        // unique local fc00::/7
            || /^fe[89ab]/.test(lower)     // link-local fe80::/10
            || /^ff/.test(lower)           // multicast
            || /^64:ff9b:/.test(lower)     // NAT64
            || /^2001:db8:/.test(lower);   // documentation
    }
    return true;
}

// DNS lookup used for the actual connection, so a hostname that resolves to
// a public address during a check and a private one at connect time (DNS
// rebinding) is still refused.
function safeLookup(hostname, options, callback) {
    dns.lookup(hostname, { all: true }, (err, addresses) => {
        if (err) return callback(err);
        const blocked = addresses.find(a => isBlockedAddress(a.address));
        if (blocked || addresses.length === 0) {
            return callback(new Error(`Refusing to connect to ${hostname}: address not allowed`));
        }
        if (options && options.all) return callback(null, addresses);
        callback(null, addresses[0].address, addresses[0].family);
    });
}

function parseImageUrl(raw) {
    let url;
    try {
        url = new URL(String(raw).trim());
    } catch {
        throw new HttpsError('invalid-argument', 'That is not a valid URL.');
    }
    if (url.protocol !== 'https:') throw new HttpsError('invalid-argument', 'Only https:// image links are supported.');
    if (url.username || url.password) throw new HttpsError('invalid-argument', 'Links with credentials are not allowed.');
    if (url.port && url.port !== '443') throw new HttpsError('invalid-argument', 'Only standard https links are supported.');
    if (net.isIP(url.hostname) && isBlockedAddress(url.hostname)) {
        throw new HttpsError('invalid-argument', 'That address is not allowed.');
    }
    return url;
}

// GETs the URL (following a few redirects, each re-validated) and returns the
// body, refusing anything that isn't a supported image or is over the size cap.
function download(url, redirectsLeft = MAX_REDIRECTS) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            lookup: safeLookup,
            timeout: REQUEST_TIMEOUT_MS,
            headers: { 'User-Agent': 'RealmOfAllania-ImageImport/1.0', Accept: 'image/*' }
        }, (res) => {
            const { statusCode, headers } = res;
            if (statusCode >= 300 && statusCode < 400 && headers.location) {
                res.resume();
                if (redirectsLeft <= 0) return reject(new HttpsError('failed-precondition', 'Too many redirects.'));
                let next;
                try {
                    next = parseImageUrl(new URL(headers.location, url).toString());
                } catch (e) {
                    return reject(e);
                }
                return download(next, redirectsLeft - 1).then(resolve, reject);
            }
            if (statusCode !== 200) {
                res.resume();
                return reject(new HttpsError('failed-precondition', `The image host answered ${statusCode}.`));
            }
            const contentType = String(headers['content-type'] || '').split(';')[0].trim().toLowerCase();
            if (!IMAGE_TYPES[contentType]) {
                res.resume();
                return reject(new HttpsError('failed-precondition', 'That link is not a JPEG, PNG, GIF or WebP image.'));
            }
            if (Number(headers['content-length']) > MAX_BYTES) {
                res.resume();
                return reject(new HttpsError('failed-precondition', 'Images must be under 5 MB.'));
            }
            const chunks = [];
            let size = 0;
            res.on('data', (chunk) => {
                size += chunk.length;
                if (size > MAX_BYTES) {
                    req.destroy();
                    reject(new HttpsError('failed-precondition', 'Images must be under 5 MB.'));
                    return;
                }
                chunks.push(chunk);
            });
            res.on('end', () => resolve({ body: Buffer.concat(chunks), contentType }));
            res.on('error', reject);
        });
        req.on('timeout', () => req.destroy(new Error('Timed out fetching the image.')));
        req.on('error', (err) => reject(err instanceof HttpsError ? err
            : new HttpsError('failed-precondition', 'Could not fetch that image.')));
    });
}

// Per-user rate limit on imports (each one costs a fetch, storage and an AI check)
async function consumeImportQuota(db, uid) {
    const ref = db.doc(`artifacts/${APP_ID}/users/${uid}/settings/imageImports`);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const now = Date.now();
        const data = snap.exists ? snap.data() : {};
        const windowStart = data.windowStart || 0;
        const inWindow = now - windowStart < 60 * 60 * 1000;
        const count = inWindow ? (data.count || 0) : 0;
        if (count >= IMPORTS_PER_HOUR) {
            throw new HttpsError('resource-exhausted', 'Too many image imports. Try again in an hour, or upload the file instead.');
        }
        tx.set(ref, {
            windowStart: inWindow ? windowStart : now,
            count: count + 1,
            updatedAt: FieldValue.serverTimestamp()
        });
    });
}

const importImageFromUrl = onCall(
    { region: "us-central1", timeoutSeconds: 30, memory: "256MiB" },
    async (request) => {
        const auth = request.auth;
        if (!auth) throw new HttpsError('unauthenticated', 'Sign in to add images.');
        if (auth.token.email_verified !== true) {
            throw new HttpsError('permission-denied', 'Verify your email address to add images.');
        }

        const { url: rawUrl, folder } = request.data || {};
        if (!ALLOWED_FOLDERS.includes(folder)) throw new HttpsError('invalid-argument', 'Unknown image folder.');
        if (typeof rawUrl !== 'string' || rawUrl.length > 2048) throw new HttpsError('invalid-argument', 'Invalid image URL.');
        const url = parseImageUrl(rawUrl);

        const db = admin.firestore();
        const account = await db.doc(`artifacts/${APP_ID}/users/${auth.uid}/settings/account`).get();
        if (account.exists && account.data().role === 'banned') {
            throw new HttpsError('permission-denied', 'Your account cannot add images.');
        }
        await consumeImportQuota(db, auth.uid);

        const { body, contentType } = await download(url);
        const type = IMAGE_TYPES[contentType];
        if (!type.magic(body)) {
            throw new HttpsError('failed-precondition', 'That file is not a valid image.');
        }

        const filePath = `artifacts/${APP_ID}/public/${folder}/${auth.uid}/${Date.now()}_import.${type.ext}`;
        const token = crypto.randomUUID();
        const bucket = admin.storage().bucket();
        // Saving triggers moderateImage, same as a direct upload
        await bucket.file(filePath).save(body, {
            contentType,
            resumable: false,
            metadata: { metadata: { firebaseStorageDownloadTokens: token, importedFrom: url.hostname } }
        });

        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
        console.log(`[Image Import] ${auth.uid} imported ${url.hostname} -> ${filePath}`);
        return { url: downloadUrl };
    }
);

module.exports = { importImageFromUrl, isBlockedAddress, parseImageUrl };
