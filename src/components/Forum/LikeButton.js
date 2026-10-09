import { useState, useEffect, memo } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { ThumbsUp } from 'lucide-react';
import { db } from '@/lib/firebase';
import { likeRef, setPostLike, canLikePost } from '@/lib/likes';

// One like per player per post, never on their own (the rules enforce both).
// The count is post.likeCount, kept by the countPostLikes Cloud Function; a
// click shows its effect at once and hands over when the new count arrives.
function LikeButton({ post, user }) {
    const canLike = canLikePost(post, user) && !!db;
    const uid = user?.uid;
    const [liked, setLiked] = useState(false);
    const [optimistic, setOptimistic] = useState(null); // { base, delta }

    useEffect(() => {
        if (!canLike) return;
        return onSnapshot(likeRef(post.id, uid), (snap) => setLiked(snap.exists()), () => {});
    }, [canLike, post.id, uid]);

    // Unpublished posts can't be liked and have nothing to show
    if ((post.status ?? 'approved') !== 'approved') return null;

    const serverCount = post.likeCount || 0;
    const count = optimistic && optimistic.base === serverCount ? Math.max(0, optimistic.base + optimistic.delta) : serverCount;

    const toggle = async () => {
        if (!canLike) return;
        const next = !liked;
        setLiked(next);
        setOptimistic({ base: serverCount, delta: next ? 1 : -1 });
        try {
            await setPostLike(post.id, uid, next);
        } catch (e) {
            console.error('Like failed:', e);
            setLiked(!next);
            setOptimistic(null);
        }
    };

    const isOwn = user && user.uid === post.userId;
    const title = !user ? 'Sign in to like posts' : isOwn ? "You can't like your own post" : liked ? 'Unlike' : 'Like';

    return (
        <button
            type="button"
            onClick={toggle}
            disabled={!canLike}
            aria-pressed={canLike ? liked : undefined}
            aria-label={`${liked ? 'Unlike' : 'Like'} post, ${count} like${count === 1 ? '' : 's'}`}
            title={title}
            className={`flex items-center gap-2 rounded border px-3 py-1.5 text-sm tabular-nums transition-colors ${isOwn
                ? 'border-ink-800 text-ink-500 cursor-not-allowed'
                : !canLike ? 'border-ink-700 text-ink-400 cursor-default'
                : liked ? 'border-gold-700 bg-gold-900/30 text-gold-300'
                : 'border-ink-700 text-ink-300 hover:border-gold-700 hover:text-gold-300'}`}
        >
            <ThumbsUp className="w-4 h-4" fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
            {count}
        </button>
    );
}

export default memo(LikeButton);
