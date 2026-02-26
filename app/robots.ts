import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/scanner-test', '/offline'],
    },
    sitemap: 'https://www.anhwms.com/sitemap.xml',
    host: 'https://www.anhwms.com',
  };
}
