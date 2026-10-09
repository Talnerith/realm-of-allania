// Thread summary fields shown on region and thread pages: the excerpt of the
// opening post and who replied last. Written only by Cloud Functions when a
// post is approved, so they always reflect moderated content.

const EXCERPT_LENGTH = 220;

// Markdown post content -> one plain-text line of at most EXCERPT_LENGTH chars
function plainExcerpt(content) {
    const text = String(content || '')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')        // images
        .replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1') // [[Wiki Links]]
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')       // [text](url)
        .replace(/<[^>]+>/g, ' ')                       // html tags
        .replace(/[*_~`#>|]+/g, '')                     // emphasis, headings, quotes
        .replace(/\s+/g, ' ')
        .trim();
    if (text.length <= EXCERPT_LENGTH) return text;
    const cut = text.slice(0, EXCERPT_LENGTH);
    const space = cut.lastIndexOf(' ');
    return `${(space > EXCERPT_LENGTH * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, '')}…`;
}

const millis = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0);

// Fields to write on the thread after `post` (id `postId`) was approved, or
// null if nothing changes. `isOpening` is true when the post is the thread's
// first post (approved together with the thread).
function threadMetaUpdate(thread, post, postId, isOpening) {
    const fields = {};
    // The opening post: approved with the thread, already recorded as such, or
    // (moderator approvals) the only post of a thread that has no excerpt yet
    const opening = isOpening || thread.openingPostId === postId
        || (!thread.openingPostId && (thread.postCount ?? 1) <= 1);
    if (opening) {
        const excerpt = plainExcerpt(post.content);
        if (excerpt !== thread.excerpt) fields.excerpt = excerpt;
        if (thread.openingPostId !== postId) fields.openingPostId = postId;
    }
    // An edit of an older post must not make it the "last reply"
    if (!thread.lastPostAt || millis(post.createdAt) >= millis(thread.lastPostAt)) {
        if (thread.lastPostBy !== post.characterName || thread.lastPostCharacterId !== (post.characterId || null)
            || millis(thread.lastPostAt) !== millis(post.createdAt)) {
            fields.lastPostBy = post.characterName || 'Unknown';
            fields.lastPostCharacterId = post.characterId || null;
            fields.lastPostAt = post.createdAt || null;
        }
    }
    return Object.keys(fields).length ? fields : null;
}

async function updateThreadMeta(db, threadId, post, postId, isOpening) {
    if (!threadId) return;
    const ref = db.doc(`artifacts/realm-of-allania-v2/public/data/threads/${threadId}`);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const fields = threadMetaUpdate(snap.data(), post, postId, isOpening);
        if (fields) tx.update(ref, fields);
    });
}

module.exports = { plainExcerpt, threadMetaUpdate, updateThreadMeta, EXCERPT_LENGTH };
