import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';

// A player's character (artifacts/{APP_ID}/users/{uid}/characters/{id}),
// fetched once per page load: thread headers and post stats show the same
// characters over and over.
const cache = new Map();

export function fetchCharacter(userId, characterId) {
  if (!db || !userId || !characterId) return Promise.resolve(null);
  const key = `${userId}/${characterId}`;
  if (!cache.has(key)) {
    cache.set(key, getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'characters', characterId))
      .then(s => (s.exists() ? s.data() : null))
      .catch(() => { cache.delete(key); return null; }));
  }
  return cache.get(key);
}

// The character doc, or null while loading / missing
export function useCharacter(userId, characterId) {
  const [character, setCharacter] = useState(null);
  useEffect(() => {
    let live = true;
    fetchCharacter(userId, characterId).then(c => { if (live) setCharacter(c); });
    return () => { live = false; };
  }, [userId, characterId]);
  return character;
}
