import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { getCatalog } from '../server/services/catalog.ts'
import { demoShippingZones, getStorefrontShippingRate } from '../server/services/shipping.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('all SEO-critical storefront route files remain present and dynamic', () => {
  for (const path of [
    '../app/pages/index.vue', '../app/pages/shop.vue', '../app/pages/search.vue',
    '../app/pages/cart.vue', '../app/pages/checkout.vue', '../app/pages/about.vue',
    '../app/pages/track-order.vue', '../app/pages/size-guide.vue', '../app/pages/[info].vue',
    '../app/pages/products/[slug].vue', '../app/pages/categories/[slug].vue',
    '../app/pages/drops/[slug].vue', '../app/pages/order-confirmation/[reference].vue',
  ]) assert.equal(existsSync(new URL(path, import.meta.url)), true, path)
  assert.match(read('../app/pages/products/[slug].vue'), /route\.params\.slug/)
  assert.match(read('../app/pages/categories/[slug].vue'), /route\.params\.slug/)
})

test('default layout preserves storefront navigation, footer, bag, language and catalog loading', () => {
  const app = read('../app/app.vue')
  const layout = read('../app/layouts/default.vue')
  assert.match(app, /<NuxtRouteAnnouncer \/>/)
  assert.match(app, /<NuxtLayout><NuxtPage \/><\/NuxtLayout>/)
  for (const value of ['<SiteHeader />', '<SiteFooter />', '<BagDrawer />', "useFetch('/api/catalog')", 'useLanguage()', 'useBag()']) {
    assert.match(layout, new RegExp(value.replace(/[<>/()]/g, '\\$&')), value)
  }
})

test('standalone catalog preserves original categories, products, prices, images and variants', async () => {
  const catalog = await getCatalog()
  assert.deepEqual(catalog.categories.map((category) => category.name.en), [
    'T-shirts', 'Tracksuits', 'Trousers',
  ])
  assert.deepEqual(catalog.products.map((product) => product.id), ['kht-001', 'kht-002', 'kht-003'])
  assert.deepEqual(catalog.products.map((product) => product.price), [890, 2390, 1290])
  assert.deepEqual(catalog.products.map((product) => product.image), [
    '/images/tee.png', '/images/tracksuit.png', '/images/pants.png',
  ])
  assert.deepEqual(catalog.products[0]?.sizes.map((size) => size.name), ['S', 'M', 'L', 'XL', 'XXL'])
})

test('D1 storefront adapter preserves stable merchandising and active navigation rules', () => {
  const catalog = read('../server/services/catalog.ts')
  assert.match(catalog, /FROM categories WHERE active = 1 ORDER BY sort_order, name_en/)
  assert.match(catalog, /WHERE p\.active = 1 AND c\.active = 1 ORDER BY p\.rowid/)
  assert.match(catalog, /WHERE active = 1 ORDER BY rowid/)
  const header = read('../app/components/SiteHeader.vue')
  const collection = read('../app/components/CollectionView.vue')
  assert.match(header, /v-for="category in catalog\.categories"/)
  assert.match(collection, /catalog\.value\.products\.filter/)
})

test('product cards, details and responsive images retain storefront behavior', () => {
  const card = read('../app/components/ProductCard.vue')
  const detail = read('../app/pages/products/[slug].vue')
  const image = read('../app/components/StoreImage.vue')
  assert.match(card, /:to="`\/products\/\$\{product\.slug\}`"/)
  assert.match(card, /loading="lazy"/)
  assert.match(detail, /:disabled="size\.stock === 0"/)
  assert.match(detail, /bag\.add\(product\.value, selectedSize\.value\)/)
  assert.match(detail, /useSeoMeta\(/)
  assert.match(image, /srcset/)
  assert.match(image, /decoding="async"/)
})

test('cart remains cookie-persisted and tracking is non-blocking without D1', () => {
  const store = read('../app/composables/useStore.ts')
  const endpoint = read('../server/api/cart/snapshot.put.ts')
  assert.match(store, /useCookie<CartLine\[]>\('kht-bag'/)
  assert.match(store, /Math\.min\(quantity, stock, 10\)/)
  assert.match(store, /\.catch\(\(\) => undefined\)/)
  assert.match(endpoint, /if \(!database\) return \{ tracked: false \}/)
})

test('standalone checkout retains server-side shipping and demo boundaries', async () => {
  assert.deepEqual(demoShippingZones.map((zone) => zone.rate), [60, 70, 90])
  assert.equal((await getStorefrontShippingRate(undefined, 'Cairo')).rate, 60)
  const page = read('../app/pages/checkout.vue')
  const endpoint = read('../server/api/checkout.post.ts')
  assert.match(page, /\/api\/shipping\/options/)
  assert.match(page, /\/api\/discounts\/quote/)
  assert.match(page, /demoAcknowledged/)
  const sampleDetails = page.slice(page.indexOf('function sampleDetails'), page.indexOf('async function submit'))
  assert.doesNotMatch(sampleDetails, /city:/)
  assert.match(endpoint, /body\?\.demoAcknowledged !== true/)
  assert.match(endpoint, /getStorefrontShippingRate\(database/)
  assert.match(endpoint, /calculateOrderTotal\(/)
  assert.doesNotMatch(endpoint, /payment_status|paymob|card details/i)
})

test('admin styles remain isolated from storefront visual selectors', () => {
  const adminCss = read('../app/assets/css/admin.css')
  const mainCss = read('../app/assets/css/main.css')
  assert.doesNotMatch(adminCss, /(?:^|\n)\s*\.(?:site-header|hero|product-page|collection-page|bag-drawer)\b/)
  assert.doesNotMatch(mainCss, /\.kht-admin\b/)
  assert.match(mainCss, /@media \(max-width: 767px\)/)
  assert.match(mainCss, /@media \(max-width: 359px\)/)
  assert.match(mainCss, /@media \(prefers-reduced-motion: reduce\)/)
})

test('storefront has no shared account route and no Paymob authority or secrets', () => {
  assert.equal(existsSync(new URL('../app/pages/login.vue', import.meta.url)), false)
  assert.equal(existsSync(new URL('../app/pages/account.vue', import.meta.url)), false)
  const appSources = [
    read('../app/pages/checkout.vue'), read('../app/pages/order-confirmation/[reference].vue'),
  ].join('\n')
  assert.doesNotMatch(appSources, /PAYMOB_|api[_-]?key|hmac|paymentStatus\s*=|payment_status\s*=/i)
})