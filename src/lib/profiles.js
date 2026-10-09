import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';
import { nameProblem } from '@/lib/moderation/textRules';

// Public player profiles (artifacts/{APP_ID}/public/data/profiles/{uid}):
// the author name shown on codex entries and posts, plus likesReceived,
// which the countPostLikes Cloud Function keeps.

export const profileRef = (uid) => doc(db, 'artifacts', APP_ID, 'public', 'data', 'profiles', uid);

// Same limits as isValidDisplayName in firestore.rules
export const isValidDisplayName = (name) =>
  typeof name === 'string' && name.trim().length >= 2 && name.length <= 30 && !nameProblem(name);

export function createProfile(uid, displayName) {
  return setDoc(profileRef(uid), { displayName, createdAt: serverTimestamp() });
}

// Self-heal for accounts made before profiles existed. Never throws: a
// missing profile only means the name falls back to "Unknown author".
export async function ensureProfile(user) {
  if (!db || !user?.uid || !isValidDisplayName(user.displayName)) return;
  try {
    const snap = await getDoc(profileRef(user.uid));
    if (!snap.exists() || !snap.data().displayName) await createProfile(user.uid, user.displayName);
  } catch (e) {
    console.warn('Could not create the public profile:', e);
  }
}

// Profiles change rarely; one fetch per author per page load is plenty
const cache = new Map();

export function fetchProfile(uid) {
  if (!db || !uid) return Promise.resolve(null);
  if (!cache.has(uid)) {
    cache.set(uid, getDoc(profileRef(uid))
      .then(snap => (snap.exists() ? snap.data() : null))
      .catch(() => { cache.delete(uid); return null; }));
  }
  return cache.get(uid);
}

// { displayName, likesReceived, createdAt } or null while loading / missing
export function useProfile(uid) {
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    let live = true;
    fetchProfile(uid).then(p => { if (live) setProfile(p); });
    return () => { live = false; };
  }, [uid]);
  return profile;
}

export const authorName = (profile) => profile?.displayName || 'Unknown author';
