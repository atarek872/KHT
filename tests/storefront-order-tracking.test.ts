import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { createStorefrontOrder } from '../server/services/storefrontCheckout.ts'
import { getOrderConfirmation, trackOrder } from '../server/services/storefrontOrders.ts'
import type { StorefrontCheckoutInput } from '../shared/storefrontOrder.ts'
import { createTestD1 } from './helpers/sqliteD1.ts'

const migrationUrls = [
  '../server/db/migrations/0001_commerce.sql',
  '../server/db/migrations/0002_products.sql',
  '../server/db/migrations/0003_categories.sql',
  '../server/db/migrations/0004_discounts.sql',
  '../server/db/migrations/0005_abandoned_carts.sql',
  '../server/db/migrations/0006_commerce_safety.sql',
  '../server/db/migrations/0007_production_commerce.sql',
].map((path) => new URL(path, import.meta.url))

function setup() {
  const result = createTestD1()
  for (const migration of migrationUrls) result.sqlite.exec(readFileSync(migration, 'utf8'))
  return result
}

const input = (): StorefrontCheckoutInput => ({
  requestId: crypto.randomUUID(),
  cartId: crypto.randomUUID(),
  customer: {
    name: 'Mariam Hassan',
    phone: '01010000001',
    email: 'private@example.test',
    address: 'Private delivery address',
    governorate: 'Cairo',
    city: 'Nasr City',
  },
  items: [{ id: 'kht-001', size: 'M', quantity: 1 }],
  shippingGovernorate: 'Cairo',
  paymentMethod: 'cod',
})

test('confirmation loads persisted order fields without contact or internal identifiers', async () => {
  const { database, close } = setup()
  try {
    const created = await createStorefrontOrder(database, input())
    const confirmation = await getOrderConfirmation(database, created.reference.toLowerCase())

    assert.equal(confirmation?.reference, created.reference)
    assert.equal(confirmation?.total, 950)
    assert.equal(confirmation?.lines[0]?.productName, 'The Line Tee')
    for (const privateField of [
      'id',
      'customerId',
      'customerPhone',
      'customerEmail',
      'deliveryAddress',
      'notes',
    ]) {
      assert.equal(privateField in (confirmation || {}), false, privateField)
    }
  } finally {
    close()
  }
})

test('tracking requires both the public reference and matching normalized phone', async () => {
  const { database, close } = setup()
  try {
    const checkout = input()
    const created = await createStorefrontOrder(database, checkout)

    assert.equal(await trackOrder(database, created.reference, '01000000000'), null)
    assert.equal(await trackOrder(database, created.reference, 'not-a-phone'), null)
    assert.equal(await trackOrder(database, 'KHT-NOT-FOUND', checkout.customer.phone), null)
    const result = await trackOrder(database, created.reference, '+20 101 000 0001')
    assert.equal(result?.reference, created.reference)
    assert.equal(result?.fulfillmentStatus, 'pending')
    assert.equal('customerId' in (result || {}), false)
    assert.equal('customerPhone' in (result || {}), false)
  } finally {
    close()
  }
})

test('public order routes and pages use durable APIs instead of browser storage', () => {
  const files = [
    '../server/api/orders/[reference].get.ts',
    '../server/api/orders/track.post.ts',
  ].map((path) => new URL(path, import.meta.url))
  for (const file of files) assert.equal(existsSync(file), true, file.pathname)

  const confirmationPage = readFileSync(
    new URL('../app/pages/order-confirmation/[reference].vue', import.meta.url),
    'utf8',
  )
  const trackingPage = readFileSync(
    new URL('../app/pages/track-order.vue', import.meta.url),
    'utf8',
  )
  assert.match(confirmationPage, /\/api\/orders\/\$\{encodeURIComponent/)
  assert.doesNotMatch(confirmationPage, /sessionStorage|DemoOrder/)
  assert.match(trackingPage, /\/api\/orders\/track/)
  assert.match(trackingPage, /phone:/)
  assert.doesNotMatch(trackingPage, /sessionStorage/)
})
