import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createStorefrontOrder } from '../server/services/storefrontCheckout.ts'
import { transitionOrder } from '../server/services/orderTransitions.ts'
import {
  getAbandonedCart,
  saveCartSnapshot,
  updateRecoveryState,
} from '../server/services/abandonedCarts.ts'
import { activateProduct, archiveProduct, getProduct } from '../server/services/adminProducts.ts'
import type { StorefrontCheckoutInput } from '../shared/storefrontOrder.ts'
import { createTestD1 } from './helpers/sqliteD1.ts'

const migrationNames = [
  '0001_commerce.sql',
  '0002_products.sql',
  '0003_categories.sql',
  '0004_discounts.sql',
  '0005_abandoned_carts.sql',
  '0006_commerce_safety.sql',
  '0007_production_commerce.sql',
  '0008_product_gallery_sale_pricing.sql',
]

function setup() {
  const result = createTestD1()
  for (const name of migrationNames) {
    result.sqlite.exec(
      readFileSync(new URL(`../server/db/migrations/${name}`, import.meta.url), 'utf8'),
    )
  }
  return result
}

function checkoutInput(
  phone: string,
  item = { id: 'kht-001', size: 'M', quantity: 1 },
): StorefrontCheckoutInput {
  return {
    requestId: crypto.randomUUID(),
    cartId: crypto.randomUUID(),
    customer: {
      name: 'Production Readiness Customer',
      phone,
      email: 'readiness@example.test',
      address: '12 Test Street',
      governorate: 'Cairo',
      city: 'Nasr City',
    },
    items: [item],
    shippingGovernorate: 'Cairo',
    paymentMethod: 'cod',
  }
}

test('complete COD operations remain durable and auditable', async () => {
  const { database, sqlite, close } = setup()
  const adminEmail = 'admin@kht.local'
  try {
    const delivered = await createStorefrontOrder(database, checkoutInput('01012223334'))
    const deliveredRow = sqlite
      .prepare('SELECT id, customer_id AS customerId FROM orders WHERE public_reference = ?')
      .get(delivered.reference) as { id: string; customerId: string }
    const customer = sqlite
      .prepare('SELECT phone_normalized AS phone FROM customers WHERE id = ?')
      .get(deliveredRow.customerId) as { phone: string }
    assert.equal(customer.phone, '201012223334')

    for (const status of ['confirmed', 'processing', 'shipped', 'delivered'] as const) {
      await transitionOrder(database, deliveredRow.id, status, adminEmail)
    }
    const finalDelivered = sqlite
      .prepare(
        'SELECT fulfillment_status AS fulfillmentStatus, payment_status AS paymentStatus FROM orders WHERE id = ?',
      )
      .get(deliveredRow.id) as { fulfillmentStatus: string; paymentStatus: string }
    assert.deepEqual(
      { ...finalDelivered },
      { fulfillmentStatus: 'delivered', paymentStatus: 'paid' },
    )
    assert.equal(
      (
        sqlite
          .prepare('SELECT COUNT(*) AS count FROM order_events WHERE order_id = ?')
          .get(deliveredRow.id) as { count: number }
      ).count,
      5,
    )

    const stockBeforeCancellation = (
      sqlite.prepare("SELECT stock FROM inventory_variants WHERE id = 'kht-003-m'").get() as {
        stock: number
      }
    ).stock
    const cancelled = await createStorefrontOrder(
      database,
      checkoutInput('01012223335', { id: 'kht-003', size: 'M', quantity: 2 }),
    )
    const cancelledRow = sqlite
      .prepare('SELECT id FROM orders WHERE public_reference = ?')
      .get(cancelled.reference) as { id: string }
    await transitionOrder(database, cancelledRow.id, 'cancelled', adminEmail)
    const stockAfterCancellation = (
      sqlite.prepare("SELECT stock FROM inventory_variants WHERE id = 'kht-003-m'").get() as {
        stock: number
      }
    ).stock
    assert.equal(stockAfterCancellation, stockBeforeCancellation)
    await assert.rejects(
      () => transitionOrder(database, cancelledRow.id, 'cancelled', adminEmail),
      /ORDER_TRANSITION_CONFLICT/,
    )
    assert.equal(
      (
        sqlite.prepare("SELECT stock FROM inventory_variants WHERE id = 'kht-003-m'").get() as {
          stock: number
        }
      ).stock,
      stockBeforeCancellation,
    )

    const contactableCartId = crypto.randomUUID()
    const anonymousCartId = crypto.randomUUID()
    const cartItems = [{ id: 'kht-002', size: 'S', quantity: 1 }]
    await saveCartSnapshot(database, {
      cartId: contactableCartId,
      items: cartItems,
      contact: { name: 'Recovery Customer', phone: '01014445556' },
    })
    await saveCartSnapshot(database, { cartId: anonymousCartId, items: cartItems })
    await updateRecoveryState(database, contactableCartId, 'contacted', adminEmail)
    await updateRecoveryState(database, contactableCartId, 'recovered', adminEmail)
    assert.equal((await getAbandonedCart(database, contactableCartId))?.events.length, 2)
    await assert.rejects(
      () => updateRecoveryState(database, anonymousCartId, 'contacted', adminEmail),
      /CART_CONTACT_REQUIRED/,
    )

    const productBefore = await getProduct(database, 'kht-001')
    assert.ok(productBefore)
    await archiveProduct(database, 'kht-001')
    assert.equal((await getProduct(database, 'kht-001'))?.active, false)
    const productAfter = await activateProduct(database, 'kht-001')
    assert.equal(productAfter.active, true)
    assert.deepEqual(
      productAfter.variants.map(({ id, active, stock }) => ({ id, active, stock })),
      productBefore.variants.map(({ id, active, stock }) => ({ id, active, stock })),
    )
  } finally {
    close()
  }
})

test('every Admin commerce mutation requires an authenticated session', () => {
  const routes = [
    'abandoned-carts/[id].patch.ts',
    'categories/[id].delete.ts',
    'categories/[id].patch.ts',
    'categories/index.post.ts',
    'discounts/[id].patch.ts',
    'discounts/index.post.ts',
    'inventory/[id].patch.ts',
    'media.delete.ts',
    'media.post.ts',
    'orders/[id].patch.ts',
    'orders/[id]/restock.post.ts',
    'orders/index.post.ts',
    'orders/quote.post.ts',
    'products/[id].patch.ts',
    'products/[id]/activate.post.ts',
    'products/[id]/archive.post.ts',
    'products/[id]/duplicate.post.ts',
    'products/index.post.ts',
    'shipping/[governorate].patch.ts',
    'shipping/index.post.ts',
  ]
  for (const route of routes) {
    const source = readFileSync(new URL(`../server/api/admin/${route}`, import.meta.url), 'utf8')
    assert.match(source, /requireAdmin\(event\)/, route)
  }
})

test('production readiness command and no-demo deployment rule are documented', () => {
  const packageJson = readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  const operations = readFileSync(
    new URL('../docs/KHT-local-admin-and-deployment.md', import.meta.url),
    'utf8',
  )
  assert.match(packageJson, /test:production-readiness/)
  assert.match(operations, /seven migrations/i)
  assert.match(operations, /never[^\n]+demo seed/i)
  assert.match(operations, /Worker version/i)
})
