// Community counters: post likes (and the author's reputation) and the
// site-wide numbers on the Landing page. Both are written only here, so the
// rules can keep clients from setting them.
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { FieldValue, FieldPath } = require("firebase-admin/firestore");

const APP_ID = 'realm-of-allania-v2';
const DATA = `artifacts/${APP_ID}/public/data`;

// +1 when a like appears, -1 when it goes, 0 for anything else
function likeDelta(before, after) {
    if (after && !before) return 1;
    if (before && !after) return -1;
    return 0;
}

const NOT_FOUND = 5;

const countPostLikes = onDocumentWritten(
    {
        document: `${DATA}/posts/{postId}/likes/{likerId}`,
        region: "us-central1",
        timeoutSeconds: 30
    },
    async (event) => {
        const delta = likeDelta(event.data?.before.exists ? event.data.before.data() : null,
            event.data?.after.exists ? event.data.after.data() : null);
        if (!delta) return;

        const db = admin.firestore();
        const postRef = db.doc(`${DATA}/posts/${event.params.postId}`);
        const post = await postRef.get();
        if (!post.exists) return; // deleted post: nothing to count against

        try {
            await postRef.update({ likeCount: FieldValue.increment(delta) });
        } catch (error) {
            if (error.code !== NOT_FOUND) throw error;
            return;
        }
        const { userId: authorId, characterId } = post.data();
        if (authorId) {
            // Reputation: the player's total, and the character's shown on its posts
            await db.doc(`${DATA}/profiles/${authorId}`).set({ likesReceived: FieldValue.increment(delta) }, { merge: true });
            if (characterId) {
                try {
                    await db.doc(`artifacts/${APP_ID}/users/${authorId}/characters/${characterId}`)
                        .update({ likesReceived: FieldValue.increment(delta) });
                } catch (error) {
                    if (error.code !== NOT_FOUND) throw error; // deleted character
                }
            }
        }
    }
);

// Collection-group query limited to this app's documents (other app ids
// live under artifacts/ too). Document paths sort segment by segment, so
// everything under artifacts/<APP_ID>/ lies between the app's own path and
// a path under it that sorts after any real id.
const LAST = String.fromCharCode(0xf8ff); // sorts after every id the app creates

function appCollectionGroup(db, collectionId) {
    return db.collectionGroup(collectionId)
        .where(FieldPath.documentId(), '>', db.doc(`artifacts/${APP_ID}`))
        .where(FieldPath.documentId(), '<', db.doc(`artifacts/${APP_ID}/${LAST}/${LAST}`));
}

async function computeSiteStats(db) {
    const count = async (q) => (await q.count().get()).data().count;
    const [members, characters, posts, regions] = await Promise.all([
        count(db.collection(`${DATA}/profiles`)),
        count(appCollectionGroup(db, 'characters')),
        count(db.collection(`${DATA}/posts`).where('status', '==', 'approved')),
        // Regions with a name (the unnamed grid squares aren't places yet)
        count(db.collection(`${DATA}/region_metadata`))
    ]);
    return { members, characters, posts, regions };
}

const updateSiteStats = onSchedule(
    { schedule: "every 6 hours", region: "us-central1", timeoutSeconds: 120 },
    async () => {
        const db = admin.firestore();
        const stats = await computeSiteStats(db);
        await db.doc(`${DATA}/stats/site`).set({ ...stats, updatedAt: FieldValue.serverTimestamp() });
        console.log('[Stats]', JSON.stringify(stats));
    }
);

module.exports = { countPostLikes, updateSiteStats, likeDelta, computeSiteStats, appCollectionGroup };
