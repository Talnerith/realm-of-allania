// Tools for the moderation dashboard that need more access than the client
// has. Storage rules only let owners delete their own files, so moderators
// remove players' images through this function instead.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const APP_ID = 'realm-of-allania-v2';
const PUBLIC_PREFIX = `artifacts/${APP_ID}/public/`;

// Only files in the public user-upload area may be deleted this way
function isDeletableImagePath(filePath) {
    return typeof filePath === 'string'
        && filePath.startsWith(PUBLIC_PREFIX)
        && filePath.length <= 1024
        && !filePath.split('/').some(part => part === '..' || part === '.' || part === '');
}

const deleteUserImage = onCall(
    { region: "us-central1", timeoutSeconds: 30 },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');

        const db = admin.firestore();
        const account = await db.doc(`artifacts/${APP_ID}/users/${request.auth.uid}/settings/account`).get();
        const role = account.exists ? account.data().role : 'user';
        if (role !== 'moderator' && role !== 'admin') {
            throw new HttpsError('permission-denied', 'Only moderators can delete player images.');
        }

        const { filePath } = request.data || {};
        if (!isDeletableImagePath(filePath)) throw new HttpsError('invalid-argument', 'Invalid image path.');

        try {
            await admin.storage().bucket().file(filePath).delete();
        } catch (error) {
            // Already gone is fine: the goal is that it no longer exists
            if (error.code !== 404) throw new HttpsError('internal', 'Could not delete the image.');
        }
        console.log(`[Moderator] ${request.auth.uid} (${role}) deleted image ${filePath}`);
        return { deleted: true };
    }
);

module.exports = { deleteUserImage, isDeletableImagePath };
