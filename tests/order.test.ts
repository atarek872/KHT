import test from 'node:test'
import assert from 'node:assert/strict'
import { priceOrder } from '../shared/order.ts'
import type { Catalog } from '../shared/types.ts'

const catalog: Catalog = {
  demo: true,
  categories: [],
  products: [
    {
      id: 'tee',
      slug: 'tee',
      name: { en: 'Tee', ar: 'تيشرت' },
      category: 'tees',
      price: 890,
      image: '/tee.png',
      description: { en: '', ar: '' },
      detail: { en: '', ar: '' },
      fit: { en: '', ar: '' },
      sizes: [
        { name: 'M', stock: 3 },
        { name: 'L', stock: 0 },
      ],
      code: '001',
    },
  ],
}
test('uses catalog price, never the client-supplied price', () => {
  const order = priceOrder([{ id: 'tee', size: 'M', quantity: 2, price: 1 }], catalog)
  assert.equal(order.subtotal, 1780)
  assert.equal(order.total, 1840)
})
test('rejects empty, negative, fractional and excessive quantities', () => {
  for (const quantity of [-1, 0, 1.5, 11])
    assert.throws(() => priceOrder([{ id: 'tee', size: 'M', quantity }], catalog))
  assert.throws(() => priceOrder([], catalog))
})
test('rejects unavailable, nonexistent sizes and unknown products', () => {
  for (const line of [
    { id: 'tee', size: 'L', quantity: 1 },
    { id: 'tee', size: 'XXL', quantity: 1 },
    { id: 'unknown', size: 'M', quantity: 1 },
  ])
    assert.throws(() => priceOrder([line], catalog))
})
test('duplicate lines cannot bypass stock limits', () =>
  assert.throws(() =>
    priceOrder(
      [
        { id: 'tee', size: 'M', quantity: 2 },
        { id: 'tee', size: 'M', quantity: 2 },
      ],
      catalog,
    ),
  ))
test('merges valid duplicate selections into one line', () => {
  const order = priceOrder(
    [
      { id: 'tee', size: 'M', quantity: 1 },
      { id: 'tee', size: 'M', quantity: 1 },
    ],
    catalog,
  )
  assert.equal(order.items.length, 1)
  assert.equal(order.items[0]?.quantity, 2)
})
