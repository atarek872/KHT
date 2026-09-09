import type { Catalog } from './types'

export const STORE_ORIGIN = 'https://kht.tknology.online'
export const DEFAULT_SOCIAL_IMAGE = `${STORE_ORIGIN}/images/campaign.png`
export const PUBLIC_ROBOTS =
  'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
export const PRIVATE_ROBOTS = 'noindex, nofollow'

export const INDEXABLE_STATIC_PATHS = [
  '/',
  '/shop',
  '/drops/001',
  '/about',
  '/size-guide',
  '/shipping',
  '/contact',
  '/faq',
  '/privacy',
  '/terms',
] as const

const PRIVATE_PATH_PREFIXES = [
  '/account',
  '/admin',
  '/api',
  '/cart',
  '/checkout',
  '/orders',
  '/order-confirmation',
  '/track-order',
  '/search',
]

export function absoluteStoreUrl(value = '/') {
  return new URL(value || '/', `${STORE_ORIGIN}/`).toString().replace(/\/$/, (slash) =>
    value === '/' || value === '' ? slash : '',
  )
}

export function isPrivateSeoPath(path: string) {
  return PRIVATE_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function sitemapUrl(path: string, image?: string, imageTitle?: string) {
  const media = image
    ? `<image:image><image:loc>${escapeXml(absoluteStoreUrl(image))}</image:loc>${
        imageTitle ? `<image:title>${escapeXml(imageTitle)}</image:title>` : ''
      }</image:image>`
    : ''
  return `<url><loc>${escapeXml(absoluteStoreUrl(path))}</loc>${media}</url>`
}

export function buildSitemapXml(catalog: Catalog) {
  const urls = [
    ...INDEXABLE_STATIC_PATHS.map((path) =>
      sitemapUrl(path, path === '/' ? '/images/campaign.png' : undefined, path === '/' ? 'KHT Drop 001' : undefined),
    ),
    ...catalog.categories.map((category) =>
      sitemapUrl(`/categories/${category.slug}`, category.image, category.name.en),
    ),
    ...catalog.products.map((product) =>
      sitemapUrl(`/products/${product.slug}`, product.image, product.name.en),
    ),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`
}

export function buildRobotsText(indexingEnabled: boolean) {
  if (!indexingEnabled) return 'User-agent: *\nDisallow: /\n'
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin/',
    `Sitemap: ${STORE_ORIGIN}/sitemap.xml`,
    '',
  ].join('\n')
}

export function breadcrumbList(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteStoreUrl(item.path),
    })),
  }
}
