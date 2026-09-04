import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { calculateDiscount, validateDiscount } from '../server/services/discounts.ts'
import type { Discount } from '../shared/discount.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const now = new Date('2026-09-04T12:00:00.000Z')
const coupon: Discount = {
  id: 'discount', code: 'WELCOME10', type: 'percentage', value: 10,
  minimumOrder: 500, maximumDiscount: 150, usageLimit: 100, currentUsage: 24,
  validFrom: '2026-09-01T00:00:00.000Z', validUntil: '2026-09-30T23:59:59.000Z',
  active: true, updatedAt: now.toISOString(),
}

test('percentage discounts respect minimum order and maximum discount', () => {
  assert.deepEqual(calculateDiscount(1000, coupon, now), { code: 'WELCOME10', discount: 100 })
  assert.deepEqual(calculateDiscount(2000, coupon, now), { code: 'WELCOME10', discount: 150 })
  assert.throws(() => calculateDiscount(400, coupon, now), /minimum order/)
})

test('fixed discounts cannot reduce subtotal below zero', () => {
  assert.deepEqual(calculateDiscount(300, { ...coupon, type: 'fixed', value: 500, minimumOrder: null, maximumDiscount: null }, now), {
    code: 'WELCOME10', discount: 300,
  })
})

test('inactive, future, expired and exhausted coupons are rejected', () => {
  assert.throws(() => calculateDiscount(1000, { ...coupon, active: false }, now), /inactive/)
  assert.throws(() => calculateDiscount(1000, { ...coupon, validFrom: '2026-09-05T00:00:00.000Z' }, now), /not active yet/)
  assert.throws(() => calculateDiscount(1000, { ...coupon, validUntil: '2026-09-03T00:00:00.000Z' }, now), /expired/)
  assert.throws(() => calculateDiscount(1000, { ...coupon, currentUsage: 100 }, now), /usage limit/)
})

test('discount validation keeps the model deliberately simple', () => {
  assert.doesNotThrow(() => validateDiscount(coupon))
  assert.throws(() => validateDiscount({ ...coupon, code: 'bad code' }), /uppercase/)
  assert.throws(() => validateDiscount({ ...coupon, value: 101 }), /cannot exceed 100/)
  assert.throws(() => validateDiscount({ ...coupon, type: 'fixed', maximumDiscount: 100 }), /only to percentage/)
  assert.throws(() => validateDiscount({ ...coupon, validFrom: 'not-a-date' }), /not a valid date/)
})

test('admin discount APIs are protected and expose only list, create and edit', () => {
  for (const path of [
    '../server/api/admin/discounts/index.get.ts', '../server/api/admin/discounts/index.post.ts',
    '../server/api/admin/discounts/[id].get.ts', '../server/api/admin/discounts/[id].patch.ts',
  ]) assert.match(read(path), /requireAdmin\(event\)/, path)
})

test('admin list and editor expose enforceable coupon fields', () => {
  const list = read('../app/pages/admin/discounts/index.vue')
  const form = read('../app/components/admin/discounts/DiscountForm.vue')
  assert.match(list, /currentUsage.*usageLimit/s)
  for (const field of ['Code', 'Discount type', 'Minimum order', 'Maximum discount', 'Usage limit', 'Valid from', 'Valid until', 'Coupon active']) assert.match(form, new RegExp(field))
  assert.doesNotMatch(form, /product targeting|stacking|buy one/i)
})

test('storefront and admin order quotes use the same server discount function', () => {
  const checkoutQuote = read('../server/api/discounts/quote.post.ts')
  const checkout = read('../server/api/checkout.post.ts')
  const adminOrder = read('../server/services/createOrder.ts')
  const storefront = read('../app/pages/checkout.vue')
  const admin = read('../app/pages/admin/orders/new.vue')
  assert.match(checkoutQuote, /quoteDiscount\(database, priced\.subtotal/)
  assert.match(checkout, /quoteDiscount\(requireDatabase\(event\), priced\.subtotal/)
  assert.match(adminOrder, /quoteDiscount\(database, priced\.subtotal/)
  assert.match(storefront, /\/api\/discounts\/quote/)
  assert.match(admin, /\/api\/admin\/orders\/quote/)
  assert.doesNotMatch(storefront, /subtotal\s*\*\s*coupon|coupon\s*\.\s*value/)
})

test('usage is consumed only by durable order triggers', () => {
  const migration = read('../server/db/migrations/0004_discounts.sql')
  assert.match(migration, /CREATE TRIGGER validate_discount_before_order/)
  assert.match(migration, /d\.current_usage < d\.usage_limit/)
  assert.match(migration, /CREATE TRIGGER consume_discount_after_order/)
  assert.match(migration, /current_usage = current_usage \+ 1/)
})