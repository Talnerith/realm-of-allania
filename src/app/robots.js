export default function robots() {
    return {
      rules: {
        userAgent: '*',
        allow: '/',
        disallow: ['/private/', '/admin/'],
      },
      sitemap: 'https://realm-of-allania.com/sitemap.xml',
    }
  }