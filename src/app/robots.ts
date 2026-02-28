import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lifeboard.ai'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/onboarding/', '/dashboard/', '/tasks/', '/calendar/', '/profile/', '/shopping-list/', '/history/', '/integrations/', '/trends/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
