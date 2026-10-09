// Builds the Content Security Policy for one page request. Scripts run only
// with this request's nonce: Next.js adds it to its own scripts (it reads it
// from the CSP request header), the root layout adds it to the theme script,
// and 'strict-dynamic' trusts scripts those load (Firebase App Check loads
// reCAPTCHA this way). No inline script without the nonce runs.
export function buildCsp(nonce, { isDev = false } = {}) {
  return [
    "default-src 'self'",
    // The google.com/gstatic hosts only matter to browsers too old for
    // 'strict-dynamic' (which ignore it and fall back to the host list)
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''} https://www.gstatic.com https://www.google.com`,
    // Inline style attributes are used throughout (object-position etc.)
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Only our own assets and Storage-hosted images (pasted links are imported
    // into Storage), so pages never load images from third-party hosts
    "img-src 'self' data: blob: https://firebasestorage.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://firestore.googleapis.com wss://*.firebaseio.com https://www.google.com https://www.gstatic.com https://*.cloudfunctions.net",
    "frame-src 'self' https://www.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
}
