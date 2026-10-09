import { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';

// Per-character figures on each post: when the character joined, how many
// approved posts it has, and its reputation (likes, kept by countPostLikes).
// Fetched once per character per page load.
const cache = new Map();

export function fetchCharacterStats(userId, characterId) {
  if (!db || !userId || !characterId) return Promise.resolve(null);
  const key = `${userId}/${characterId}`;
  if (!cache.has(key)) {
    const charP = getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'characters', characterId))
      .then(s => (s.exists() ? s.data() : null)).catch(() => null);
    const countP = getCountFromServer(query(
      collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'),
      where('characterId', '==', characterId),
      where('status', '==', 'approved')
    )).then(s => s.data().count).catch(() => null);
    cache.set(key, Promise.all([charP, countP]).then(([c, posts]) => ({
      joined: c?.createdAt || null,
      posts,
      reputation: c?.likesReceived || 0
    })));
  }
  return cache.get(key);
}

export default function useCharacterStats(userId, characterId) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let live = true;
    fetchCharacterStats(userId, characterId).then(s => { if (live) setStats(s); });
    return () => { live = false; };
  }, [userId, characterId]);
  return stats;
}

// "Mar 2024"
export const joinedLabel = (ts) => {
  const ms = ts?.toMillis?.();
  return ms ? new Date(ms).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—';
};
