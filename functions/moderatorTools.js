// Tools for the moderation dashboard that need more access than the client
// has. Storage rules only let owners delete their own files, so moderators
// remove players' images through this function instead.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

const APP_ID = 'realm-of-allania-v2';
const PUBLIC_PREFIX = `artifacts/${APP_ID}/public/`;
const STAFF_ROLES = ['moderator', 'admin'];

// Only files in the public user-upload area may be deleted this way
function isDeletableImagePath(filePath) {
    return typeof filePath === 'string'
        && filePath.startsWith(PUBLIC_PREFIX)
        && filePath.length <= 1024
        && !filePath.split('/').some(part => part === '..' || part === '.' || part === '');
}

// The uploader's uid for artifacts/<app>/public/<folder>/<uid>/<file>, or
// null for files outside a player's folder (legacy uploads)
function imageOwner(filePath) {
    const parts = filePath.split('/');
    return parts.length === 6 ? parts[4] : null;
}

// Whether a caller with `role` may delete this file. Admins may delete any
// public upload. Moderators may delete players' uploads and their own, but
// not files in an admin's or another moderator's folder, nor legacy files
// whose uploader is unknown.
function canDeleteImage({ role, callerUid, ownerUid, ownerRole }) {
    if (role === 'admin') return true;
    if (role !== 'moderator' || !ownerUid) return false;
    return ownerUid === callerUid || !STAFF_ROLES.includes(ownerRole);
}

const getRole = async (db, uid) => {
    const account = await db.doc(`artifacts/${APP_ID}/users/${uid}/settings/account`).get();
    return account.exists ? (account.data().role || 'user') : 'user';
};

const deleteUserImage = onCall(
    { region: "us-central1", timeoutSeconds: 30, enforceAppCheck: true },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');

        const db = admin.firestore();
        const callerUid = request.auth.uid;
        const role = await getRole(db, callerUid);
        if (!STAFF_ROLES.includes(role)) {
            throw new HttpsError('permission-denied', 'Only moderators can delete player images.');
        }

        const { filePath } = request.data || {};
        if (!isDeletableImagePath(filePath)) throw new HttpsError('invalid-argument', 'Invalid image path.');

        const ownerUid = imageOwner(filePath);
        const ownerRole = ownerUid && ownerUid !== callerUid ? await getRole(db, ownerUid) : null;
        if (!canDeleteImage({ role, callerUid, ownerUid, ownerRole })) {
            throw new HttpsError('permission-denied', 'Only an admin can delete this image.');
        }

        try {
            await admin.storage().bucket().file(filePath).delete();
        } catch (error) {
            // Already gone is fine: the goal is that it no longer exists
            if (error.code !== 404) throw new HttpsError('internal', 'Could not delete the image.');
        }

        // Audit trail. Its own type, so it doesn't show up as an image to review
        await db.collection(`artifacts/${APP_ID}/public/data/moderation_logs`).add({
            type: 'image_deletion',
            filePath,
            userId: ownerUid,
            ownerRole,
            deletedBy: callerUid,
            deletedByRole: role,
            status: 'deleted',
            moderationMethod: 'manual-admin',
            timestamp: FieldValue.serverTimestamp()
        });
        console.log(`[Moderator] ${callerUid} (${role}) deleted image ${filePath}`);
        return { deleted: true };
    }
);

// The image behind a moderation entry, for the dashboard. Held images have no
// working URL (see heldImages.js), so the bytes come back as a data: URL,
// which the site's CSP already allows for images.
const PREVIEW_MAX_BYTES = 5 * 1024 * 1024; // the upload limit
const previewImage = onCall(
    { region: "us-central1", timeoutSeconds: 30, memory: "512MiB", enforceAppCheck: true },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
        const db = admin.firestore();
        if (!STAFF_ROLES.includes(await getRole(db, request.auth.uid))) {
            throw new HttpsError('permission-denied', 'Only moderators can preview images.');
        }
        const { filePath } = request.data || {};
        if (!isDeletableImagePath(filePath)) throw new HttpsError('invalid-argument', 'Invalid image path.');

        const file = admin.storage().bucket().file(filePath);
        let metadata;
        try {
            [metadata] = await file.getMetadata();
        } catch (error) {
            if (error.code === 404) throw new HttpsError('not-found', 'This image no longer exists.');
            throw new HttpsError('internal', 'Could not load the image.');
        }
        const contentType = metadata.contentType || '';
        if (!/^image\/(jpeg|png|gif|webp)$/.test(contentType) || Number(metadata.size) > PREVIEW_MAX_BYTES) {
            throw new HttpsError('failed-precondition', 'This file cannot be previewed.');
        }
        const [bytes] = await file.download();
        return { dataUrl: `data:${contentType};base64,${bytes.toString('base64')}` };
    }
);

module.exports = { deleteUserImage, previewImage, isDeletableImagePath, imageOwner, canDeleteImage };
