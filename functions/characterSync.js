// Keeps the character details copied onto posts and threads (name, race,
// class, portrait) in step with the character itself. Runs server-side so a
// rename or delete is applied to every post at once, however many there are,
// and without loosening the rules that stop users editing those fields.
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

const APP_ID = 'realm-of-allania-v2';
const DISPLAY_FIELDS = ['name', 'race', 'class', 'imageUrl', 'imagePosition'];

// Post fields to write after a character changed, or null if nothing that
// posts display changed. `after` is undefined when the character was deleted.
function characterPostFields(before, after) {
    if (!after) {
        return {
            characterName: `${before.name || 'Unknown'} [Deleted]`,
            characterImageUrl: '',
            characterImagePosition: 'center'
        };
    }
    const changed = DISPLAY_FIELDS.some(field => (before[field] ?? null) !== (after[field] ?? null));
    if (!changed) return null;
    return {
        characterName: after.name,
        characterRace: after.race ?? '',
        characterClass: after.class ?? '',
        characterImageUrl: after.imageUrl ?? '',
        characterImagePosition: after.imagePosition || 'center'
    };
}

const syncCharacter = onDocumentWritten(
    {
        document: "artifacts/realm-of-allania-v2/users/{userId}/characters/{charId}",
        region: "us-central1",
        timeoutSeconds: 300
    },
    async (event) => {
        const before = event.data?.before.data();
        const after = event.data?.after.data();
        if (!before) return; // newly created: nothing has been posted with it yet

        const postFields = characterPostFields(before, after);
        if (!postFields) return;

        const { userId, charId } = event.params;
        const db = admin.firestore();
        const data = `artifacts/${APP_ID}/public/data`;

        // Scoped to this user's documents, so a forged characterId elsewhere
        // can't be rewritten through someone else's character
        const [posts, threads, lastPostThreads, codexPages] = await Promise.all([
            db.collection(`${data}/posts`).where('userId', '==', userId).where('characterId', '==', charId).get(),
            db.collection(`${data}/threads`).where('creatorId', '==', userId).where('characterId', '==', charId).get(),
            // Threads whose latest reply ("last post by") is this character's
            db.collection(`${data}/threads`).where('lastPostUserId', '==', userId).where('lastPostCharacterId', '==', charId).get(),
            after ? null : db.collection(`${data}/codex_pages`).where('creatorId', '==', userId).where('relatedId', '==', charId).get()
        ]);

        // One update per thread, also when the character both started it and
        // posted last
        const threadUpdates = new Map();
        const addThreadUpdate = (doc, fields) => {
            const pending = threadUpdates.get(doc.ref.path);
            threadUpdates.set(doc.ref.path, { ref: doc.ref, fields: { ...pending?.fields, ...fields } });
        };
        threads.forEach(doc => addThreadUpdate(doc, { createdBy: postFields.characterName }));
        lastPostThreads.forEach(doc => addThreadUpdate(doc, { lastPostBy: postFields.characterName }));

        // BulkWriter batches, parallelises and retries, with no 500-write limit
        const writer = db.bulkWriter();
        posts.forEach(doc => writer.update(doc.ref, postFields));
        threadUpdates.forEach(({ ref, fields }) => writer.update(ref, fields));
        // A deleted character's profile page is kept as archived lore
        codexPages?.forEach(doc => {
            const archived = { title: `[Archived] ${before.name}`, category: 'Lore' };
            writer.update(doc.ref, {
                ...archived,
                ...(doc.get('approvedSnapshot') && {
                    'approvedSnapshot.title': archived.title,
                    'approvedSnapshot.category': archived.category
                })
            });
        });
        await writer.close();

        console.log(`[Character] ${after ? 'Updated' : 'Deleted'} ${userId}/${charId}: ` +
            `${posts.size} posts, ${threadUpdates.size} threads, ${codexPages?.size ?? 0} codex pages`);
    }
);

module.exports = { syncCharacter, characterPostFields };
