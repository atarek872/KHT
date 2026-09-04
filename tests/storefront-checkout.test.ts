import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createStorefrontOrder } from '../server/services/storefrontCheckout.ts'
import { getCatalog } from '../server/services/catalog.ts'
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
  const testDatabase = createTestD1()
  for (const migration of migrationUrls) {
    testDatabase.sqlite.exec(readFileSync(migration, 'utf8'))
  }
  return testDatabase
}

function count(sqlite: ReturnType<typeof createTestD1>['sqlite'], table: string) {
  return Number(
    (sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count,
  )
}

const checkoutInput = (): StorefrontCheckoutInput => ({
  requestId: crypto.randomUUID(),
  cartId: crypto.randomUUID(),
  customer: {
    name: 'Mariam Hassan',
    phone: '01010000001',
    email: 'mariam@example.test',
    address: '12 Abbas El Akkad Street',
    governorate: 'Cairo',
    city: 'Nasr City',
  },
  items: [{ id: 'kht-001', size: 'M', quantity: 2 }],
  shippingGovernorate: 'Cairo',
  paymentMethod: 'cod',
})

test('guest checkout creates one customer and one order from server prices', async () => {
  const { database, sqlite, close } = setup()
  try {
    const input = checkoutInput()
    const first = await createStorefrontOrder(database, input)
    const second = await createStorefrontOrder(database, input)

    assert.equal(second.reference, first.reference)
    assert.equal(first.subtotal, 1780)
    assert.equal(first.shipping, 60)
    assert.equal(first.total, 1840)
    assert.equal(first.paymentMethod, 'cod')
    assert.equal(first.paymentStatus, 'pending')
    assert.equal(first.fulfillmentStatus, 'pending')
    assert.equal('id' in first, false)
    assert.equal(count(sqlite, 'customers'), 1)
    assert.equal(count(sqlite, 'orders'), 1)
    assert.equal(count(sqlite, 'order_items'), 1)
    assert.equal(
      (sqlite.prepare('SELECT source FROM orders').get() as { source: string }).source,
      'website',
    )
    assert.equal(
      (
        sqlite.prepare("SELECT stock FROM inventory_variants WHERE id = 'kht-001-m'").get() as {
          stock: number
        }
      ).stock,
      10,
    )
  } finally {
    close()
  }
})

test('repeat normalized phone updates one CRM customer without losing order history', async () => {
  const { database, sqlite, close } = setup()
  try {
    const input = checkoutInput()
    await createStorefrontOrder(database, input)
    await createStorefrontOrder(database, {
      ...input,
      requestId: crypto.randomUUID(),
      customer: {
        ...input.customer,
        phone: '+20 101 000 0001',
        address: 'New delivery address',
      },
      items: [{ id: 'kht-001', size: 'M', quantity: 1 }],
    })

    assert.equal(count(sqlite, 'customers'), 1)
    assert.equal(count(sqlite, 'orders'), 2)
    const customer = sqlite.prepare('SELECT phone_normalized, address FROM customers').get() as {
      phone_normalized: string
      address: string
    }
    assert.equal(customer.phone_normalized, '201010000001')
    assert.equal(customer.address, 'New delivery address')
  } finally {
    close()
  }
})

test('successful checkout converts its cart and creates an initial order event atomically', async () => {
  const { database, sqlite, close } = setup()
  try {
    const input = checkoutInput()
    sqlite
      .prepare(
        `INSERT INTO abandoned_carts
      (id, subtotal, items_count, state, recovery_state, last_activity)
      VALUES (?, 1780, 2, 'active', 'active', CURRENT_TIMESTAMP)`,
      )
      .run(input.cartId)

    await createStorefrontOrder(database, input)

    const cart = sqlite
      .prepare(
        `SELECT state, recovery_state, recovered_order_id
      FROM abandoned_carts WHERE id = ?`,
      )
      .get(input.cartId) as {
      state: string
      recovery_state: string
      recovered_order_id: string | null
    }
    assert.equal(cart.state, 'converted')
    assert.equal(cart.recovery_state, 'converted')
    assert.ok(cart.recovered_order_id)
    assert.equal(count(sqlite, 'order_events'), 1)
  } finally {
    close()
  }
})

test('checkout rejects unsupported payment and malformed Egyptian phone numbers', async () => {
  const { database, close } = setup()
  try {
    const input = checkoutInput()
    await assert.rejects(
      () =>
        createStorefrontOrder(database, {
          ...input,
          paymentMethod: 'card',
        } as StorefrontCheckoutInput),
      /Cash on delivery is the only available payment method/,
    )
    await assert.rejects(
      () =>
        createStorefrontOrder(database, {
          ...input,
          requestId: crypto.randomUUID(),
          customer: { ...input.customer, phone: '12345' },
        }),
      /Egyptian mobile number/,
    )
  } finally {
    close()
  }
})

test('configured catalog failures do not fall back to products that cannot be ordered', async () => {
  const brokenDatabase = {
    prepare() {
      return {
        all: async () => {
          throw new Error('D1 unavailable')
        },
      }
    },
  }
  await assert.rejects(() => getCatalog(brokenDatabase as never), /D1 unavailable/)
})
