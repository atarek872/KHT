import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('customer list aggregates orders, qualified spend and last order on the server', () => {
  const service = read('../server/services/adminCustomers.ts')
  assert.match(service, /COUNT\(o\.id\) AS ordersCount/)
  assert.match(service, /o\.payment_status = 'paid' OR o\.fulfillment_status = 'delivered'/)
  assert.match(service, /SUM\([\s\S]*o\.total ELSE 0 END\)/)
  assert.match(service, /MAX\(o\.created_at\) AS lastOrderAt/)
  assert.match(service, /GROUP BY c\.id/)
})

test('customer search prioritizes phone, then name, then email', () => {
  const service = read('../server/services/adminCustomers.ts')
  const priority = /CASE[\s\S]*WHEN c?\.?phone LIKE \? THEN 0[\s\S]*WHEN c?\.?name LIKE \? THEN 1[\s\S]*WHEN COALESCE\(c?\.?email, ''\) LIKE \? THEN 2/
  assert.match(service, priority)
  assert.match(service, /phone LIKE \? OR name LIKE \? OR COALESCE\(email, ''\) LIKE \?/)
})

test('customer APIs are authenticated and details include order history', () => {
  const list = read('../server/api/admin/customers/index.get.ts')
  const detail = read('../server/api/admin/customers/[id].get.ts')
  const service = read('../server/services/adminCustomers.ts')
  assert.match(list, /requireAdmin\(event\)/)
  assert.match(detail, /requireAdmin\(event\)/)
  assert.match(service, /WHERE o\.customer_id = \? ORDER BY o\.created_at DESC/)
  assert.match(service, /address: customer\.address/)
})

test('customer list exposes required fields and responsive presentations', () => {
  const page = read('../app/pages/admin/customers/index.vue')
  for (const field of ['Name', 'Phone', 'Email', 'Orders', 'Total spent', 'Last order']) {
    assert.match(page, new RegExp(`>${field}<`, 'i'), field)
  }
  assert.match(page, /Search priority: phone, name, then email/)
  assert.match(page, /admin-customers-desktop/)
  assert.match(page, /admin-customers-mobile/)
  assert.match(page, /status === 'pending'/)
  assert.match(page, /v-else-if="error"/)
  assert.match(page, /v-else-if="!data\?\.items\.length"/)
})

test('customer details remain lean and show contact, address, metrics and orders', () => {
  const page = read('../app/pages/admin/customers/[id].vue')
  for (const field of ['Contact information', 'Address', 'Order history', 'Orders', 'Total spent', 'Last order']) {
    assert.match(page, new RegExp(field, 'i'), field)
  }
  assert.match(page, /`\/admin\/orders\/\$\{order\.id\}`/)
  assert.doesNotMatch(page, /pipeline|sales stage|task|lead score/i)
})

test('customer views switch from table to cards below desktop width', () => {
  const css = read('../app/assets/css/admin.css')
  assert.match(css, /\.kht-admin \.admin-customers-mobile\s*\{\s*display:\s*none/)
  assert.match(css, /@media \(max-width: 1023px\)[\s\S]*\.admin-customers-desktop\s*\{\s*display:\s*none/)
  assert.match(css, /@media \(max-width: 1023px\)[\s\S]*\.admin-customers-mobile\s*\{\s*display:\s*grid/)
})