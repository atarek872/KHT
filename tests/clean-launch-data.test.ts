import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { createTestD1 } from './helpers/sqliteD1.ts'

const migrations = [
  '0001_commerce.sql',
  '0002_products.sql',
  '0003_categories.sql',
  '0004_discounts.sql',
  '0005_abandoned_carts.sql',
  '0006_commerce_safety.sql',
  '0007_production_commerce.sql',
]

const operationUrl = new URL('../server/db/operations/empty-commerce.sql', import.meta.url)

test('clean launch operation leaves no catalog, shipping, customer, order, or cart data', () => {
  assert.equal(existsSync(operationUrl), true, 'empty-commerce.sql should exist')

  const { sqlite, close } = createTestD1()
  try {
    for (const migration of migrations) {
      sqlite.exec(
        readFileSync(new URL(`../server/db/migrations/${migration}`, import.meta.url), 'utf8'),
      )
    }

    sqlite.exec(readFileSync(operationUrl, 'utf8'))

    for (const table of [
      'products',
      'inventory_variants',
      'categories',
      'shipping_zones',
      'discounts',
      'customers',
      'orders',
      'order_items',
      'order_events',
      'abandoned_carts',
      'abandoned_cart_items',
      'abandoned_cart_events',
      'request_rate_limits',
      'admin_sessions',
    ]) {
      const row = sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
        count: number
      }
      assert.equal(row.count, 0, `${table} should be empty`)
    }
  } finally {
    close()
  }
})
