import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { getAdminOrder, listAdminOrders } from '../server/services/adminOrders.ts'
import { createStorefrontOrder } from '../server/services/storefrontCheckout.ts'
import { createTestD1 } from './helpers/sqliteD1.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('admin orders do not expose tab-local demo previews as persistent orders', async () => {
  const result = await listAdminOrders()

  assert.equal(result.availability, 'unavailable')
  assert.deepEqual(result.items, [])
  assert.equal(result.total, 0)
  assert.match(result.message, /Demo order previews remain in the customer tab only/)
})

test('admin orders advertise only backend-supported search, filters and transitions', async () => {
  const list = await listAdminOrders()
  const detail = await getAdminOrder('DEMO-1234')

  for (const supported of Object.values(list.capabilities)) assert.equal(supported, false)
  assert.equal(detail.availability, 'unavailable')
  assert.equal(detail.order, null)
  assert.deepEqual(detail.capabilities, list.capabilities)
})

test('orders list includes required columns and separate desktop and mobile presentations', () => {
  const page = read('../app/pages/admin/orders/index.vue')

  for (const column of [
    'Order',
    'Customer',
    'Total',
    'Payment',
    'Payment status',
    'Fulfillment',
    'Source',
    'Date',
  ]) {
    assert.match(page, new RegExp(`>${column}<`, 'i'), column)
  }
  assert.match(page, /class="admin-orders-desktop"/)
  assert.match(page, /class="admin-orders-mobile"/)
  assert.match(page, /`\/admin\/orders\/\$\{order\.id\}`/)
  assert.match(page, /v-else-if="data\?\.availability === 'unavailable'"/)
  assert.match(page, /v-else-if="data\?\.availability === 'empty'/)
})

test('order details expose required commerce fields and server-controlled status actions', () => {
  const page = read('../app/pages/admin/orders/[id]/index.vue')

  for (const field of [
    'Payment status',
    'Fulfillment status',
    'Payment method',
    'Source',
    'Products',
    'Quantity',
    'Unit price',
    'Subtotal',
    'Shipping',
    'Discount',
    'Total',
    'Customer',
    'Phone',
    'Address',
    'Notes',
  ]) {
    assert.match(page, new RegExp(field, 'i'), field)
  }
  assert.match(page, /method:\s*'PATCH'/)
  assert.match(page, /allowedFulfillmentTransitions/)
  assert.match(page, /AdminConfirmDialog/)
  assert.match(page, /order\.events/)
})

test('orders CSS switches from table to structured cards below desktop width', () => {
  const css = read('../app/assets/css/admin.css')

  assert.match(css, /\.kht-admin \.admin-orders-mobile\s*\{\s*display:\s*none/)
  assert.match(
    css,
    /@media \(max-width: 1023px\)[\s\S]*\.admin-orders-desktop\s*\{\s*display:\s*none/,
  )
  assert.match(
    css,
    /@media \(max-width: 1023px\)[\s\S]*\.admin-orders-mobile\s*\{\s*display:\s*grid/,
  )
  assert.match(
    css,
    /@media \(max-width: 767px\)[\s\S]*\.admin-order-detail__status\s*\{\s*grid-template-columns:\s*1fr/,
  )
})

test('every order has a protected 10 by 15 centimetre shipping label', () => {
  const list = read('../app/pages/admin/orders/index.vue')
  const detail = read('../app/pages/admin/orders/[id]/index.vue')
  const label = read('../app/pages/admin/orders/[id]/print.vue')

  assert.match(list, /`\/admin\/orders\/\$\{order\.id\}\/print`/)
  assert.match(detail, /`\/admin\/orders\/\$\{order\.id\}\/print`/)
  assert.match(label, /definePageMeta\(\{ layout: false \}\)/)
  assert.match(label, /\/api\/admin\/orders\//)
  assert.match(label, /@page\s*\{[\s\S]*size:\s*100mm 150mm/)
  assert.match(label, /width:\s*100mm/)
  assert.match(label, /height:\s*150mm/)
  assert.match(label, /window\.print\(\)/)

  for (const field of [
    'customerName',
    'customerPhone',
    'customerEmail',
    'address',
    'productName',
    'variant',
    'quantity',
    'unitPrice',
    'shipping',
    'discount',
    'total',
    'paymentMethod',
  ]) {
    assert.match(label, new RegExp(field), field)
  }
  assert.match(label, /brand\.logoUrl/)
  assert.match(label, /Black\. White\. Line\./)
  assert.match(label, /shipping-label__brand-mark/)
  assert.match(label, /shipping-label__dispatch-strip/)
  assert.match(label, /font-size:\s*14pt/)
  assert.match(label, /font-size:\s*12pt/)
  assert.match(label, /font-size:\s*8\.2pt/)
  assert.doesNotMatch(label, />Payment status</)
  assert.doesNotMatch(label, />Order status</)
})

test('eligible orders expose visible deletion with a simple confirmation for cancelled orders', () => {
  const list = read('../app/pages/admin/orders/index.vue')
  const detail = read('../app/pages/admin/orders/[id]/index.vue')
  for (const page of [list, detail]) {
    assert.match(page, /method:\s*'DELETE'/)
    assert.match(page, /AdminConfirmDialog/)
    assert.match(page, /required-confirmation/)
    assert.match(page, /fulfillmentStatus === 'cancelled'\s*\?\s*''/)
    assert.match(page, /orderNumber/)
  }
  assert.match(list, /order\.canDelete/)
  assert.match(list, /admin-orders-desktop[\s\S]*admin-order-delete-action/)
  assert.match(list, /admin-orders-mobile[\s\S]*admin-order-delete-action/)
  assert.match(detail, /order\.deleteBlockReason/)
  assert.match(detail, /navigateTo\(`\/admin\/orders/)
})

test('a mixed-size order keeps both variants on the admin order used by the shipping label', async () => {
  const fixture = createTestD1()
  try {
    const migrationDirectory = new URL('../server/db/migrations/', import.meta.url)
    for (const name of readdirSync(migrationDirectory)
      .filter((file) => file.endsWith('.sql'))
      .sort())
      fixture.sqlite.exec(readFileSync(new URL(name, migrationDirectory), 'utf8'))
    const created = await createStorefrontOrder(fixture.database, {
      requestId: crypto.randomUUID(),
      cartId: crypto.randomUUID(),
      customer: {
        name: 'Label Test',
        phone: '01010000022',
        address: '12 Test Street',
        governorate: 'Cairo',
        city: 'Cairo',
      },
      items: [
        { id: 'kht-001', size: 'M', quantity: 1 },
        { id: 'kht-001', size: 'L', quantity: 1 },
      ],
      shippingGovernorate: 'Cairo',
      paymentMethod: 'cod',
    })
    const saved = fixture.sqlite
      .prepare('SELECT id FROM orders WHERE number=?')
      .get(created.number) as { id: string }
    const detail = await getAdminOrder(saved.id, fixture.database)
    assert.equal(detail.order?.lines.length, 2)
    assert.deepEqual(
      detail.order?.lines.map((line) => line.variant),
      ['Black / M', 'Black / L'],
    )
    assert.deepEqual(
      detail.order?.lines.map((line) => line.quantity),
      [1, 1],
    )
  } finally {
    fixture.close()
  }
})

test('shipping label reserves visible room for product rows and prints after rendering', () => {
  const label = read('../app/pages/admin/orders/[id]/print.vue')
  assert.match(label, /v-for="line in order\.lines"/)
  assert.match(label, /\.shipping-label\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column/s)
  assert.match(label, /\.shipping-label__summary\s*\{[^}]*margin-top:\s*auto/s)
  assert.doesNotMatch(label, /grid-template-rows:\s*auto auto minmax\(/)
  assert.doesNotMatch(label, /\.shipping-label__items\s*\{[^}]*overflow:\s*hidden/s)
  assert.match(label, /document\.fonts\.ready/)
})
