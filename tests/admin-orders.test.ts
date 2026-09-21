import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getAdminOrder, listAdminOrders } from '../server/services/adminOrders.ts'

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
    'paymentStatus',
    'fulfillmentStatus',
  ]) {
    assert.match(label, new RegExp(field), field)
  }
  assert.match(label, /brand\.logoUrl/)
})
