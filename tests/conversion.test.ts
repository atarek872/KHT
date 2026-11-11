import assert from 'node:assert/strict'
import test from 'node:test'
import { campaignFromQuery, sanitizeCampaignAttribution } from '../shared/campaignAttribution.ts'
import { sendOnce } from '../shared/analyticsOnce.ts'
import { fullSetDiscountPercent, setSavingsForLines } from '../shared/setOffer.ts'
import type { Catalog, Product } from '../shared/types.ts'

test('campaign values survive navigation without accepting contact details or tracking IDs', () => {
  assert.deepEqual(
    campaignFromQuery({
      utm_source: 'facebook',
      utm_campaign: 'drop_001',
      fbclid: 'private-click-id',
    }),
    { source: 'facebook', campaign: 'drop_001' },
  )
  assert.equal(sanitizeCampaignAttribution({ source: 'customer@example.com' }), null)
})

test('Full Set savings use current catalog variant prices and quantities', () => {
  const product = (slug: string, id: string, price: number): Product => ({
    id,
    slug,
    price,
    code: id,
    name: { en: id, ar: id },
    category: 'drop',
    compareAtPrice: null,
    image: '',
    images: [],
    description: { en: '', ar: '' },
    detail: { en: '', ar: '' },
    fit: { en: '', ar: '' },
    sizes: [{ name: 'M', stock: 5, price }],
  })
  const catalog: Catalog = {
    demo: false,
    categories: [],
    products: [
      product('line-01-full-set-black', 'set', 2190),
      product('line-01-oversized-hoodie-black', 'hoodie', 1390),
      product('line-01-wide-leg-pants-black', 'pants', 1050),
    ],
  }
  assert.equal(setSavingsForLines(catalog, [{ id: 'set', size: 'M', quantity: 2 }]), 500)
  assert.equal(fullSetDiscountPercent(catalog, 'M'), 10)
  assert.equal(setSavingsForLines(catalog, [{ id: 'hoodie', size: 'M', quantity: 1 }]), 0)
})

test('successful Purchase dispatch is deduplicated and failed dispatch can retry', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
  let events = 0
  assert.equal(
    sendOnce('order-failed', () => false, storage),
    false,
  )
  assert.equal(
    sendOnce(
      'order-failed',
      () => {
        events++
        return true
      },
      storage,
    ),
    true,
  )
  assert.equal(
    sendOnce(
      'order-failed',
      () => {
        events++
        return true
      },
      storage,
    ),
    false,
  )
  assert.equal(events, 1)
})
