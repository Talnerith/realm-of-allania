import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';

// One like per player per post: the like's id is the player's uid. The rules
// allow it only on approved posts that aren't the player's own, and the
// countPostLikes Cloud Function keeps post.likeCount in step.
export const likeRef = (postId, uid) =>
  doc(db, 'artifacts', APP_ID, 'public', 'data', 'posts', postId, 'likes', uid);

export function setPostLike(postId, uid, liked) {
  const ref = likeRef(postId, uid);
  return liked ? setDoc(ref, { createdAt: serverTimestamp() }) : deleteDoc(ref);
}

// Whether this player may like this post (mirrors the rules)
export const canLikePost = (post, user) =>
  !!user && !!post && user.uid !== post.userId && (post.status ?? 'approved') === 'approved';
