import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

// Only images hosted in this project's Firebase Storage are displayed. Those
// have been through image moderation, can't be swapped for something else
// after approval, and loading them doesn't reveal viewers' IP addresses to a
// third-party host. Pasted links are imported into Storage first.
const STORAGE_PREFIX = 'https://firebasestorage.googleapis.com/v0/b/';

// A Storage object name is a single URL-encoded path segment: no "/", no
// backslash, no dot segments. Browsers resolve "/o/../../other-bucket/o/x",
// so a plain prefix check would let any bucket's images through.
const OBJECT_NAME = /^[^/\\?#]+$/;

export function isHostedImageUrl(url) {
  if (typeof url !== 'string' || url.length === 0) return false;
  // The site's own static assets (but not protocol-relative "//host" or
  // "/\host" URLs, which browsers treat as another host)
  if (url.startsWith('/')) return !/^\/[/\\]/.test(url) && !url.includes('\\');
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  // No bucket configured: not the live site (design previews, tests), so
  // inline sample images may show too. The site always has a bucket.
  if (!bucket && url.startsWith('data:image/')) return true;
  const prefix = bucket ? `${STORAGE_PREFIX}${bucket}/o/` : STORAGE_PREFIX;
  if (!url.startsWith(prefix)) return false;
  if (!bucket) return true;
  const objectName = url.slice(prefix.length).split(/[?#]/)[0];
  return OBJECT_NAME.test(objectName) && !/^(\.|%2e){1,2}$/i.test(objectName);
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
