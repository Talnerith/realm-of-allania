// The site's public origin, for metadata, robots.txt and the sitemap.
// On Vercel production this is the primary custom domain (www.allania.ca).
export const getSiteUrl = (env = process.env) => {
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return 'http://localhost:3000';
};

export const SITE_URL = getSiteUrl();
