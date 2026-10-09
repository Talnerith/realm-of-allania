import { SITE_URL } from '@/lib/siteUrl';

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/private/', '/admin/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
