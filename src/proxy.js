import { NextResponse } from 'next/server';
import { buildCsp } from '@/lib/csp';

export function proxy(request) {
  // A fresh, unguessable nonce per request
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  // 'unsafe-eval' is only required by React's dev tooling; production drops it
  const csp = buildCsp(nonce, { isDev: process.env.NODE_ENV === 'development' });

  // Next.js reads the nonce from the request's CSP header while rendering;
  // the layout reads x-nonce for its own inline script
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Link prefetches don't render a page, so they need no nonce.
     */
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sitemap.xml|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
