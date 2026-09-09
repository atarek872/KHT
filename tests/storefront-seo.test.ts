import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { Catalog } from '../shared/types.ts'
import {
  STORE_ORIGIN,
  absoluteStoreUrl,
  buildRobotsText,
  buildSitemapXml,
  serializeJsonLd,
} from '../shared/storefrontSeo.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const readJsonc = (path: string) => JSON.parse(read(path).replace(/,\s*([}\]])/g, '$1'))

const catalog: Catalog = {
  demo: false,
  categories: [{ slug: 'hoodies', name: { en: 'Hoodies', ar: 'هوديز' }, image: '/hoodie.jpg' }],
  products: [
    {
      id: 'one',
      slug: 'line-hoodie',
      name: { en: 'Line Hoodie', ar: 'هودي لاين' },
      category: 'hoodies',
      price: 1100,
      compareAtPrice: 1300,
      image: '/hoodie.jpg',
      images: ['/hoodie.jpg'],
      description: { en: 'A black hoodie.', ar: 'هودي أسود.' },
      detail: { en: 'Cotton.', ar: 'قطن.' },
      fit: { en: 'Oversized.', ar: 'أوفر سايز.' },
      sizes: [{ name: 'M', stock: 2 }],
      code: 'KHT-HOODIE',
    },
  ],
}

test('SEO URL and JSON-LD helpers keep the custom domain canonical and output safe', () => {
  assert.equal(STORE_ORIGIN, 'https://kht.tknology.online')
  assert.equal(absoluteStoreUrl('/products/line-hoodie'), `${STORE_ORIGIN}/products/line-hoodie`)
  assert.equal(absoluteStoreUrl('https://cdn.example/image.jpg'), 'https://cdn.example/image.jpg')
  assert.equal(serializeJsonLd({ name: '</script><script>alert(1)</script>' }).includes('</script>'), false)
})

test('robots allows production discovery, blocks staging, and advertises the sitemap', () => {
  const production = buildRobotsText(true)
  assert.match(production, /User-agent: \*/)
  assert.match(production, /Allow: \//)
  assert.match(production, /Sitemap: https:\/\/kht\.tknology\.online\/sitemap\.xml/)
  assert.match(buildRobotsText(false), /Disallow: \//)
})

test('sitemap contains only absolute canonical public catalog URLs', () => {
  const sitemap = buildSitemapXml(catalog)
  for (const path of [
    '/',
    '/shop',
    '/drops/001',
    '/categories/hoodies',
    '/products/line-hoodie',
    '/about',
    '/shipping',
  ]) assert.match(sitemap, new RegExp(`<loc>${STORE_ORIGIN}${path.replace('/', '\\/')}`))
  assert.doesNotMatch(sitemap, /search|cart|checkout|account|admin|workers\.dev/)
})

test('Cloudflare keeps staging private and exposes only the custom production origin', () => {
  const config = readJsonc('../wrangler.jsonc')
  assert.equal(config.env.staging.vars.NUXT_PUBLIC_STORE_INDEXING_ENABLED, 'false')
  assert.equal(config.env.production.vars.NUXT_PUBLIC_STORE_INDEXING_ENABLED, 'true')
  assert.equal(config.env.production.workers_dev, false)
  assert.deepEqual(config.assets.run_worker_first, ['/robots.txt', '/sitemap.xml'])
})

test('Nuxt renders environment-aware robots defaults and reusable canonical metadata', () => {
  const nuxt = read('../nuxt.config.ts')
  const layout = read('../app/layouts/default.vue')
  const composable = read('../app/composables/useStoreSeo.ts')
  const helpers = read('../shared/storefrontSeo.ts')
  assert.doesNotMatch(nuxt, /name:\s*'robots'/)
  assert.match(layout, /storeIndexingEnabled/)
  assert.match(helpers, /max-image-preview:large/)
  for (const path of ['/account', '/cart', '/checkout', '/orders', '/order-confirmation', '/track-order', '/search']) {
    assert.match(helpers, new RegExp(path.replace('/', '\\/')))
  }
  assert.match(composable, /rel:\s*'canonical'/)
  assert.match(composable, /summary_large_image/)
  assert.match(composable, /application\/ld\+json/)
})

test('public pages emit truthful store, product, offer, and breadcrumb data', () => {
  const homepage = read('../app/pages/index.vue')
  const product = read('../app/pages/products/[slug].vue')
  const collection = read('../app/components/CollectionView.vue')
  const info = read('../app/pages/[info].vue')
  assert.match(homepage, /OnlineStore/)
  assert.match(homepage, /MerchantReturnPolicy/)
  assert.match(homepage, /WebSite/)
  assert.match(product, /'@type':\s*'Product'/)
  assert.match(product, /'@type':\s*'Offer'/)
  assert.match(product, /priceCurrency:\s*'EGP'/)
  assert.match(product, /schema\.org\/(?:InStock|OutOfStock)/)
  assert.match(product, /breadcrumbList/)
  assert.doesNotMatch(product, /aggregateRating|reviewRating/)
  assert.match(collection, /useStoreSeo/)
  assert.match(collection, /breadcrumbList/)
  assert.match(read('../shared/storefrontSeo.ts'), /'@type':\s*'BreadcrumbList'/)
  assert.match(info, /String\(route\.params\.info\) === 'returns'/)
  assert.match(info, /canonicalPath/)
})

test('robots and sitemap routes use live runtime and catalog data', () => {
  const robots = read('../server/routes/robots.txt.ts')
  const sitemap = read('../server/routes/sitemap.xml.ts')
  assert.match(robots, /NUXT_PUBLIC_STORE_INDEXING_ENABLED/)
  assert.match(robots, /buildRobotsText/)
  assert.match(sitemap, /getCatalog\(getDatabase\(event\)/)
  assert.match(sitemap, /buildSitemapXml/)
  assert.match(sitemap, /application\/xml/)
})
