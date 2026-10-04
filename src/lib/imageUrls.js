import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

// Only images hosted in this project's Firebase Storage are displayed. Those
// have been through image moderation, can't be swapped for something else
// after approval, and loading them doesn't reveal viewers' IP addresses to a
// third-party host. Pasted links are imported into Storage first.
const STORAGE_PREFIX = 'https://firebasestorage.googleapis.com/v0/b/';

export function isHostedImageUrl(url) {
  if (typeof url !== 'string' || url.length === 0) return false;
  // The site's own static assets (but not protocol-relative "//host" URLs)
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  return bucket ? url.startsWith(`${STORAGE_PREFIX}${bucket}/o/`) : url.startsWith(STORAGE_PREFIX);
}

// The URL if it may be displayed, otherwise '' (render a placeholder instead)
export function hostedImageUrl(url) {
  return isHostedImageUrl(url) ? url : '';
}

// Copies the image at a pasted URL into the user's Storage folder (where it is
// moderated like any upload) and returns the hosted URL. Throws with a
// user-facing message on failure.
export async function importImageFromUrl(url, folder) {
  if (!functions) throw new Error('Image import is unavailable right now.');
  try {
    const result = await httpsCallable(functions, 'importImageFromUrl')({ url, folder });
    return result.data.url;
  } catch (e) {
    throw new Error(e?.message || 'Could not import that image.');
  }
}
