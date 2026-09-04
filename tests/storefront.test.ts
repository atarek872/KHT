import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { matchesProduct } from '../app/utils/productSearch.ts'
import type { Product } from '../shared/types.ts'

const tee = {
  name: { en: 'The Line Tee', ar: 'تيشرت ذا لاين' },
  category: 'tees',
  description: { en: 'Oversized silhouette', ar: 'قصة واسعة' },
} as Product
test('search finds a tee through storefront category vocabulary and spelling variants', () => {
  for (const query of ['T-shirt', 't shirts', 'T‑SHIRTS', 'تي شيرت', 'تيشرتات', 'oversized tee']) {
    assert.equal(matchesProduct(tee, query), true, query)
  }
  assert.equal(matchesProduct(tee, 'unrelated'), false)
})
test('search includes localized catalog category names', () => {
  assert.equal(
    matchesProduct(tee, 'Essentials', [
      { slug: 'tees', name: { en: 'Essentials', ar: 'أساسيات' }, image: '' },
    ]),
    true,
  )
})

test('checkout phone constraint accepts numbers and rejects malformed input in browser v mode', () => {
  const source = readFileSync(new URL('../app/pages/checkout.vue', import.meta.url), 'utf8')
  const pattern = source.match(/pattern="([^"]+)"/)![1]
  const phone = new RegExp(`^(?:${pattern})$`, 'v')
  for (const value of ['01000000000', '+20 (10) 1234-5678', '٠١٠١٢٣٤٥٦٧٨'])
    assert.equal(phone.test(value), true, value)
  for (const value of ['abcdefg', '-------', '123', '+20abc123456', '123456789012345678901'])
    assert.equal(phone.test(value), false, value)
})
