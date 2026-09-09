import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const readJsonc = (path: string) =>
  JSON.parse(read(path).replace(/^\s*\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1'))

test('Google Analytics is production-scoped and allowed by the storefront CSP', () => {
  const config = readJsonc('../wrangler.jsonc')
  assert.equal(config.env.production.vars.NUXT_PUBLIC_GOOGLE_TAG_ID, 'G-YHQBDWSBKG')
  assert.equal(config.env.staging.vars.NUXT_PUBLIC_GOOGLE_TAG_ID, '')

  const nuxt = read('../nuxt.config.ts')
  assert.match(nuxt, /googleTagId:\s*environment\.NUXT_PUBLIC_GOOGLE_TAG_ID\s*\|\|\s*''/)

  const layout = read('../app/layouts/default.vue')
  assert.match(layout, /googletagmanager\.com\/gtag\/js\?id=/)
  assert.match(layout, /window\.dataLayer\s*=\s*window\.dataLayer\s*\|\|\s*\[\]/)
  assert.match(layout, /gtag\('config'/)
  assert.match(layout, /\^G-\[A-Z0-9\]\+\$/)

  const security = read('../server/middleware/securityHeaders.ts')
  assert.match(security, /script-src[^\n]*googletagmanager\.com/)
  assert.match(security, /connect-src[^\n]*google-analytics\.com/)
})

test('the storefront sends the four GA4 commerce events from successful customer actions', () => {
  const product = read('../app/pages/products/[slug].vue')
  assert.match(product, /trackViewItem/)
  assert.match(product, /trackAddToCart/)

  const checkout = read('../app/pages/checkout.vue')
  assert.match(checkout, /trackBeginCheckout/)
  assert.match(checkout, /trackPurchase/)

  const analytics = read('../app/composables/useStoreAnalytics.ts')
  for (const event of ['view_item', 'add_to_cart', 'begin_checkout', 'purchase']) {
    assert.match(analytics, new RegExp(`['\"]${event}['\"]`), event)
  }
  for (const field of [
    'transaction_id',
    'currency',
    'value',
    'shipping',
    'coupon',
    'item_id',
    'item_name',
    'item_category',
    'item_variant',
    'price',
    'quantity',
  ]) {
    assert.match(analytics, new RegExp(field), field)
  }
  assert.doesNotMatch(analytics, /email|phone|address/i)
})
