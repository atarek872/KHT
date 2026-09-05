import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const storefrontFiles = [
  '../app/pages/[info].vue',
  '../app/pages/cart.vue',
  '../app/pages/checkout.vue',
  '../app/pages/order-confirmation/[reference].vue',
  '../app/pages/track-order.vue',
  '../app/components/SiteFooter.vue',
  '../app/components/SiteHeader.vue',
  '../app/components/CollectionView.vue',
  '../app/components/SizeGuideContent.vue',
  '../app/pages/index.vue',
  '../app/pages/about.vue',
  '../app/pages/products/[slug].vue',
]

test('storefront no longer claims checkout is a concept preview', () => {
  const sources = storefrontFiles.map(read).join('\n')
  assert.doesNotMatch(
    sources,
    /concept preview|concept storefront|no commercial order|demo total|preview order|متجر تصوري|نسخة تصورية|تجريبية/i,
  )
})

test('policies describe actual COD, exchanges, and cart data handling', () => {
  const page = read('../app/pages/[info].vue')
  assert.match(page, /cash on delivery|الدفع عند الاستلام/i)
  assert.match(page, /14 calendar days|أربعة عشر يوم/i)
  assert.match(page, /30 calendar days|ثلاثين يوم/i)
  assert.match(page, /cart contents|محتويات السلة/i)
  assert.match(page, /inspection at delivery|فحص الطلب عند الاستلام/i)
  assert.doesNotMatch(page, /19588/)
  assert.doesNotMatch(page, /Shopify|credit card/i)
})

test('approved Drop and story images are scoped without changing the homepage hero', () => {
  const drop = read('../app/components/CollectionView.vue')
  const about = read('../app/pages/about.vue')
  const home = read('../app/pages/index.vue')
  assert.match(drop, /src="\/images\/drop-001-banner\.jpg"/)
  assert.match(about, /src="\/images\/our-story-cover\.png"/)
  assert.match(home, /src="\/images\/campaign\.png"/)
  assert.equal(existsSync(new URL('../public/images/drop-001-banner.jpg', import.meta.url)), true)
  assert.equal(existsSync(new URL('../public/images/our-story-cover.png', import.meta.url)), true)
})

test('public contact settings and indexing gate are explicit', () => {
  const storeConfig = read('../shared/storeConfig.ts')
  const nuxtConfig = read('../nuxt.config.ts')
  const environment = read('../.env.example')
  const footer = read('../app/components/SiteFooter.vue')

  for (const name of ['storeContactEmail', 'storePhone', 'storeWhatsApp']) {
    assert.match(storeConfig, new RegExp(name))
    assert.match(nuxtConfig, new RegExp(name))
  }
  for (const name of [
    'NUXT_PUBLIC_STORE_CONTACT_EMAIL',
    'NUXT_PUBLIC_STORE_PHONE',
    'NUXT_PUBLIC_STORE_WHATSAPP',
    'NUXT_PUBLIC_STORE_INDEXING_ENABLED',
  ]) {
    assert.match(environment, new RegExp(name))
  }
  assert.match(nuxtConfig, /STORE_INDEXING_ENABLED/)
  assert.match(footer, /contact\.email/)
  assert.match(footer, /contact\.phone/)
  assert.match(footer, /contact\.whatsapp/)
})
