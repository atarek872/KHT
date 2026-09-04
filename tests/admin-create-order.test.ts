import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { prepareOrder } from '../server/services/createOrder.ts'
import type { CreateOrderInput, OrderVariantOption } from '../shared/createOrder.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const variants: OrderVariantOption[] = [
  { id: 'tee-m', productId: 'tee', productName: 'Line Tee', sku: 'TEE-M', size: 'M', color: 'Black', unitPrice: 890, stock: 3 },
]
const input: CreateOrderInput = {
  requestId: 'request-1',
  customer: { name: 'Ahmed', phone: '01000000000', email: '', address: 'Street 1', governorate: 'Cairo', city: 'Nasr City' },
  items: [{ variantId: 'tee-m', quantity: 2 }],
  shippingGovernorate: 'Cairo',
  paymentMethod: 'cod',
  source: 'instagram',
}

test('manual orders use server variant prices and configured shipping', () => {
  const priced = prepareOrder(input, variants, { governorate: 'Cairo', rate: 60 })
  assert.equal(priced.subtotal, 1780)
  assert.equal(priced.shipping, 60)
  assert.equal(priced.discount, 0)
  assert.equal(priced.total, 1840)
})

test('manual orders reject overselling, invalid shipping and unsupported payment', () => {
  assert.throws(() => prepareOrder({ ...input, items: [{ variantId: 'tee-m', quantity: 4 }] }, variants, { governorate: 'Cairo', rate: 60 }), /stock/)
  assert.throws(() => prepareOrder({ ...input, shippingGovernorate: 'Giza' }, variants, { governorate: 'Cairo', rate: 60 }), /Shipping zone/)
  assert.throws(() => prepareOrder({ ...input, paymentMethod: 'paymob' } as CreateOrderInput, variants, { governorate: 'Cairo', rate: 60 }), /Only COD/)
})

test('manual orders merge duplicate variants under the shared quantity limit', () => {
  const priced = prepareOrder({ ...input, items: [
    { variantId: 'tee-m', quantity: 1 }, { variantId: 'tee-m', quantity: 2 },
  ] }, variants, { governorate: 'Cairo', rate: 60 })
  assert.equal(priced.lines.length, 1)
  assert.equal(priced.lines[0]?.quantity, 3)
  assert.throws(() => prepareOrder({ ...input, items: [
    { variantId: 'tee-m', quantity: 2 }, { variantId: 'tee-m', quantity: 2 },
  ] }, variants, { governorate: 'Cairo', rate: 60 }), /stock/)
})

test('D1 schema enforces idempotency and atomic inventory checks', () => {
  const migration = read('../server/db/migrations/0001_commerce.sql')
  assert.match(migration, /idempotency_key TEXT NOT NULL UNIQUE/)
  assert.match(migration, /CREATE TRIGGER reserve_inventory_before_order_item/)
  assert.match(migration, /RAISE\(ABORT, 'INSUFFICIENT_STOCK'\)/)
  assert.match(migration, /CREATE TRIGGER decrement_inventory_after_order_item/)
  assert.match(migration, /UPDATE inventory_variants SET stock = stock - NEW.quantity/)
})

test('create-order UI contains five steps, customer search, exact variants, COD and review', () => {
  const page = read('../app/pages/admin/orders/new.vue')
  for (const step of ['Customer', 'Products', 'Shipping', 'Payment', 'Review']) {
    assert.match(page, new RegExp(`'${step}'`), step)
  }
  assert.match(page, /\/api\/admin\/customers/)
  assert.match(page, /variant\.sku/)
  assert.match(page, /variant\.stock/)
  assert.match(page, /Cash on delivery/)
  assert.match(page, /Manual Paymob payments are not supported/)
  assert.match(page, /:loading="busy"/)
  assert.match(page, /`\/admin\/orders\/\$\{result\.order\.id\}`/)
})

test('create-order API is authenticated and persists through one D1 batch', () => {
  const endpoint = read('../server/api/admin/orders/index.post.ts')
  const service = read('../server/services/createOrder.ts')
  assert.match(endpoint, /await requireAdmin\(event\)/)
  assert.match(service, /await database\.batch\(statements\)/)
  assert.match(service, /WHERE idempotency_key = \?/)
  assert.match(service, /if \(existing\.order\) return existing\.order/)
  assert.doesNotMatch(service, /paymentMethod:\s*'paymob'/)
})

test('admin routes are session-protected and logout clears the server session', () => {
  const middleware = read('../app/middleware/admin-auth.global.ts')
  const logout = read('../server/api/admin/logout.post.ts')
  const header = read('../app/components/admin/AdminHeader.vue')
  assert.match(middleware, /\/api\/admin\/session/)
  assert.match(middleware, /redirect: to\.fullPath/)
  assert.match(logout, /destroyAdminSession\(event\)/)
  assert.match(header, /\/api\/admin\/logout/)
})

test('public catalog maps D1 products and inventory without changing its storefront shape', () => {
  const endpoint = read('../server/api/catalog.get.ts')
  const service = read('../server/services/catalog.ts')
  assert.match(endpoint, /getCatalog\(getDatabase\(event\)\)/)
  assert.match(service, /inventory_variants/)
  assert.match(service, /WHERE p\.active = 1 AND c\.active = 1/)
  assert.match(service, /map\(\(variant\) => \(\{ name: variant\.size, stock: variant\.stock \}\)\)/)
})

test('create order uses customer lookup mode and preserves selected customer identity', () => {
  const page = read('../app/pages/admin/orders/new.vue')
  const service = read('../server/services/createOrder.ts')
  assert.match(page, /query: \{ q: customerQuery\.value, mode: 'lookup' \}/)
  assert.match(service, /input\.customer\.id/)
  assert.match(service, /SELECT id FROM customers WHERE id = \?/)
  assert.match(service, /UPDATE customers SET name = \?, phone = \?/)
})