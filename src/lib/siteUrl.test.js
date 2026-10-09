import { getSiteUrl } from './siteUrl';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';

describe('getSiteUrl', () => {
  it('prefers the production domain', () => {
    expect(getSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'www.allania.ca', VERCEL_URL: 'x.vercel.app' }))
      .toBe('https://www.allania.ca');
  });

  it('falls back to the deployment URL, then localhost', () => {
    expect(getSiteUrl({ VERCEL_URL: 'x.vercel.app' })).toBe('https://x.vercel.app');
    expect(getSiteUrl({})).toBe('http://localhost:3000');
  });
});

describe('robots and sitemap', () => {
  it('point at this site, not another domain', () => {
    const site = getSiteUrl();
    expect(robots().sitemap).toBe(`${site}/sitemap.xml`);
    expect(sitemap().map((entry) => entry.url)).toEqual([`${site}/`]);
  });
});
