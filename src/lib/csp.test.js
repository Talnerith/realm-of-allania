import { buildCsp } from '@/lib/csp';

const directive = (csp, name) => csp.split('; ').find(d => d.startsWith(`${name} `));

describe('buildCsp', () => {
  it('lets scripts run only with the request nonce (no inline scripts)', () => {
    const scripts = directive(buildCsp('abc123'), 'script-src');
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });

  it('allows eval only in development (React dev tooling)', () => {
    expect(directive(buildCsp('n', { isDev: true }), 'script-src')).toContain("'unsafe-eval'");
  });

  it('keeps the hosts reCAPTCHA / App Check and Firebase need', () => {
    const csp = buildCsp('n');
    expect(directive(csp, 'script-src')).toEqual(expect.stringContaining('https://www.google.com'));
    expect(directive(csp, 'script-src')).toEqual(expect.stringContaining('https://www.gstatic.com'));
    expect(directive(csp, 'frame-src')).toContain('https://www.google.com');
    expect(directive(csp, 'connect-src')).toEqual(expect.stringContaining('wss://*.firebaseio.com'));
    expect(directive(csp, 'connect-src')).toEqual(expect.stringContaining('https://*.googleapis.com'));
  });

  it('only loads images from the site and Firebase Storage', () => {
    expect(directive(buildCsp('n'), 'img-src')).toBe("img-src 'self' data: blob: https://firebasestorage.googleapis.com");
  });
});
