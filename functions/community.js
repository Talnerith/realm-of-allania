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

// Recounts a post's likes and moves the author's reputation by however much
// the count changed. Idempotent: events can be delivered twice or out of
// order, and a repeat finds the stored likeCount already right and changes
// nothing (plain increments drifted, even below zero).
async function recountPostLikes(db, postId) {
    const postRef = db.doc(`${DATA}/posts/${postId}`);
    return db.runTransaction(async (tx) => {
        const [post, likes] = await Promise.all([
            tx.get(postRef),
            tx.get(postRef.collection('likes').count())
        ]);
        if (!post.exists) return 0; // deleted post: nothing to count against

        const count = likes.data().count;
        const delta = count - (post.get('likeCount') || 0);
        if (!delta) return 0;

        // Reputation: the player's total, and the character's shown on its posts
        const { userId: authorId, characterId } = post.data();
        const characterRef = authorId && characterId
            ? db.doc(`artifacts/${APP_ID}/users/${authorId}/characters/${characterId}`)
            : null;
        const character = characterRef ? await tx.get(characterRef) : null; // all reads before writes

        tx.update(postRef, { likeCount: count });
        if (authorId) {
            tx.set(db.doc(`${DATA}/profiles/${authorId}`), { likesReceived: FieldValue.increment(delta) }, { merge: true });
            if (character?.exists) tx.update(characterRef, { likesReceived: FieldValue.increment(delta) }); // deleted character: skip
        }
        return delta;
    });
}

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

        await recountPostLikes(admin.firestore(), event.params.postId);
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

module.exports = { countPostLikes, updateSiteStats, likeDelta, recountPostLikes, computeSiteStats, appCollectionGroup };
