// Images the AI couldn't clear (an unclear reply, an OpenRouter failure, the
// uploader's hourly limit) are held until a moderator decides, the same way
// pending text stays hidden.
//
// Holding moves the file's download token aside, so the URL already saved in
// a portrait, banner or gallery stops working (403), and marks the file
// moderation: 'held', which storage.rules use to refuse reads (so no new
// token can be minted) and owner updates (so the mark can't be removed).
// Approving restores the same token, so every saved URL works again.
// Rejecting deletes the file. The moderator's decision is the log entry's
// status, changed from the dashboard; onImageReviewed acts on it.
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { FieldValue } = require("firebase-admin/firestore");

const APP_ID = 'realm-of-allania-v2';
const HELD = 'held';

async function holdImage(file) {
    const [metadata] = await file.getMetadata();
    const custom = metadata.metadata || {};
    if (custom.moderation === HELD) return;
    await file.setMetadata({
        metadata: {
            // null removes a custom metadata key
            firebaseStorageDownloadTokens: null,
            heldDownloadTokens: custom.firebaseStorageDownloadTokens || '',
            moderation: HELD
        }
    });
}

async function releaseImage(file) {
    const [metadata] = await file.getMetadata();
    const custom = metadata.metadata || {};
    if (custom.moderation !== HELD) return;
    await file.setMetadata({
        metadata: {
            // The original token, so URLs saved before the hold work again
            firebaseStorageDownloadTokens: custom.heldDownloadTokens || crypto.randomUUID(),
            heldDownloadTokens: null,
            moderation: null
        }
    });
}

const isHeld = (metadata) => (metadata?.metadata || {}).moderation === HELD;

async function notify(db, userId, type, message, extra) {
    if (!userId) return;
    try {
        await db.collection(`artifacts/${APP_ID}/users`).doc(userId).collection('notifications').add({
            type, message, metadata: { contentType: 'image', ...extra }, read: false, createdAt: FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error('[Held Images] Could not notify', userId, e.message);
    }
}

// A moderator approved or rejected an image entry on the dashboard
async function handleImageReview(event) {
    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};
    if (after.type !== 'image' || !after.filePath || before.status === after.status) return;

    const db = admin.firestore();
    const file = admin.storage().bucket().file(after.filePath);
    try {
        if (after.status === 'approved') {
            await releaseImage(file);
            if (before.status === 'needs_review') {
                await notify(db, after.userId, 'image_approved', 'Your image was approved by a moderator.', { filePath: after.filePath });
            }
        } else if (after.status === 'rejected') {
            await file.delete({ ignoreNotFound: true });
            await notify(db, after.userId, 'image_rejected', 'Your uploaded image was rejected by a moderator.', { filePath: after.filePath });
        }
        console.log(`[Held Images] ${after.status}: ${after.filePath}`);
    } catch (e) {
        console.error(`[Held Images] Could not apply "${after.status}" to ${after.filePath}:`, e.message);
    }
}

const onImageReviewed = onDocumentUpdated(
    { document: `artifacts/${APP_ID}/public/data/moderation_logs/{logId}`, region: "us-central1" },
    handleImageReview
);

module.exports = { holdImage, releaseImage, isHeld, handleImageReview, onImageReviewed, HELD };
