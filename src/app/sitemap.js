import { SITE_URL } from '@/lib/siteUrl';

// The whole app lives on one URL (navigation is in-memory), and /admin is
// disallowed in robots.txt, so the home page is the only entry.
export default function sitemap() {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];
}
