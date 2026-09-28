import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { Product } from '../shared/types.ts'
import {
  metaCartPayload,
  metaProductPayload,
  metaPurchasePayload,
  safeMetaSearchTerm,
} from '../shared/metaCommerce.ts'

const product: Product = {
  id: 'product-1',
  code: 'KHT-001',
  slug: 'kht-001',
  name: { en: 'KHT Line Set', ar: 'طقم KHT' },
  category: 'sets',
  price: 1200,
  compareAtPrice: null,
  image: '/set.webp',
  images: ['/set.webp'],
  description: { en: '', ar: '' },
  detail: { en: '', ar: '' },
  fit: { en: '', ar: '' },
  sizes: [
    { name: 'M', stock: 5, price: 1200 },
    { name: 'L', stock: 5, price: 1500 },
  ],
}

test('Meta product events use the displayed size price and stable product code', () => {
  assert.deepEqual(metaProductPayload(product), {
    content_ids: ['KHT-001'],
    content_type: 'product',
    content_name: 'KHT Line Set',
    content_category: 'sets',
    contents: [{ id: 'KHT-001', quantity: 1, item_price: 1200 }],
    currency: 'EGP',
    value: 1200,
  })
  assert.deepEqual(metaProductPayload(product, 'L'), {
    content_ids: ['KHT-001'],
    content_type: 'product',
    content_name: 'KHT Line Set',
    content_category: 'sets',
    contents: [{ id: 'KHT-001', quantity: 1, item_price: 1500 }],
    currency: 'EGP',
    value: 1500,
  })
})

test('Meta checkout and purchase events preserve quantities and actual order total', () => {
  const lines = [
    { id: product.id, product, size: 'M', quantity: 2 },
    { id: product.id, product, size: 'L', quantity: 1 },
  ]
  const checkout = metaCartPayload(lines, 3900)
  assert.deepEqual(checkout.content_ids, ['KHT-001'])
  assert.deepEqual(checkout.contents, [
    { id: 'KHT-001', quantity: 2, item_price: 1200 },
    { id: 'KHT-001', quantity: 1, item_price: 1500 },
  ])
  assert.equal(checkout.num_items, 3)
  assert.equal(checkout.value, 3900)
  assert.deepEqual(metaPurchasePayload(lines, 3750, 'KHT-ORDER-1'), {
    ...checkout,
    value: 3750,
    order_id: 'KHT-ORDER-1',
  })
})

test('Search tracking omits empty queries and obvious contact details', () => {
  assert.equal(safeMetaSearchTerm('  oversized hoodie  '), 'oversized hoodie')
  assert.equal(safeMetaSearchTerm(''), null)
  assert.equal(safeMetaSearchTerm('customer@example.com'), null)
  assert.equal(safeMetaSearchTerm('+20 101 234 5678'), null)
})

test('Meta events are attached to successful store actions without sending customer details', () => {
  const analytics = readFileSync(
    new URL('../app/composables/useStoreAnalytics.ts', import.meta.url),
    'utf8',
  )
  for (const event of [
    'ViewContent',
    'AddToCart',
    'InitiateCheckout',
    'Purchase',
    'Search',
    'CompleteRegistration',
  ]) {
    assert.match(analytics, new RegExp(`['"]${event}['"]`), event)
  }
  assert.doesNotMatch(analytics, /form\.value\.(email|phone|address)|customer\.user\.value/)

  const checkout = readFileSync(new URL('../app/pages/checkout.vue', import.meta.url), 'utf8')
  assert.match(checkout, /trackPurchase\(\{/)
  const account = readFileSync(
    new URL('../app/components/account/AccountAuth.vue', import.meta.url),
    'utf8',
  )
  assert.match(account, /trackCompleteRegistration/)
  const search = readFileSync(
    new URL('../app/components/CollectionView.vue', import.meta.url),
    'utf8',
  )
  assert.match(search, /trackSearch/)
})
