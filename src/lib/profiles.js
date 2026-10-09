import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
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

// Why a name can't be a display name (user-facing), or null
export function displayNameProblem(name, { allowReserved = false } = {}) {
  if (typeof name !== 'string' || name.trim().length < 2) return 'Names need at least 2 characters.';
  if (name.length > 30) return 'Names can be at most 30 characters.';
  return nameProblem(name, { allowReserved });
}

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

// Renames the player's public profile (created if it's missing)
export async function saveProfileName(uid, displayName) {
  const ref = profileRef(uid);
  const snap = await getDoc(ref);
  if (snap.exists()) await updateDoc(ref, { displayName });
  else await createProfile(uid, displayName);
  cache.delete(uid);
}

// Sets (or, with '', removes) the player's author picture
export async function saveProfileAvatar(uid, avatarUrl, avatarPosition = 'center') {
  await updateDoc(profileRef(uid), { avatarUrl, avatarPosition });
  cache.delete(uid);
}

export function fetchProfile(uid) {
  if (!db || !uid) return Promise.resolve(null);
  if (!cache.has(uid)) {
    cache.set(uid, getDoc(profileRef(uid))
      .then(snap => (snap.exists() ? snap.data() : null))
      .catch(() => { cache.delete(uid); return null; }));
  }
  return cache.get(uid);
}

// { displayName, avatarUrl, avatarPosition, likesReceived, createdAt } or null while loading / missing
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
