import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'

const migrationUrls = [
  '../server/db/migrations/0001_commerce.sql',
  '../server/db/migrations/0002_products.sql',
  '../server/db/migrations/0003_categories.sql',
  '../server/db/migrations/0004_discounts.sql',
  '../server/db/migrations/0005_abandoned_carts.sql',
  '../server/db/migrations/0006_commerce_safety.sql',
  '../server/db/migrations/0007_production_commerce.sql',
].map((path) => new URL(path, import.meta.url))

const seedUrl = new URL('../server/db/seeds/local-demo.sql', import.meta.url)

function count(database: DatabaseSync, table: string) {
  return Number(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()!.count)
}

test('local demo seed provides complete, repeatable admin test data', () => {
  assert.ok(existsSync(seedUrl), 'Local demo seed SQL is missing')

  const database = new DatabaseSync(':memory:')
  for (const migrationUrl of migrationUrls) {
    database.exec(readFileSync(migrationUrl, 'utf8'))
  }

  const seed = readFileSync(seedUrl, 'utf8')
  database.exec(seed)
  database.exec(seed)

  assert.deepEqual(
    {
      categories: count(database, 'categories'),
      products: count(database, 'products'),
      variants: count(database, 'inventory_variants'),
      customers: count(database, 'customers'),
      orders: count(database, 'orders'),
      orderItems: count(database, 'order_items'),
      discounts: count(database, 'discounts'),
      abandonedCarts: count(database, 'abandoned_carts'),
    },
    {
      categories: 3,
      products: 3,
      variants: 15,
      customers: 5,
      orders: 6,
      orderItems: 7,
      discounts: 4,
      abandonedCarts: 4,
    },
  )

  assert.deepEqual(
    database
      .prepare('SELECT fulfillment_status AS status FROM orders ORDER BY number')
      .all()
      .map((row) => row.status),
    ['delivered', 'shipped', 'processing', 'confirmed', 'pending', 'cancelled'],
  )
  assert.equal(
    database
      .prepare(
        "SELECT COUNT(*) AS count FROM abandoned_carts WHERE state = 'active' AND datetime(last_activity) <= datetime('now', '-30 minutes')",
      )
      .get()!.count,
    2,
  )
  assert.equal(
    database.prepare("SELECT current_usage AS usage FROM discounts WHERE code = 'WELCOME10'").get()!
      .usage,
    1,
  )
  assert.equal(
    database.prepare("SELECT stock FROM inventory_variants WHERE id = 'kht-001-m'").get()!.stock,
    10,
  )
  assert.equal(
    database.prepare("SELECT stock FROM inventory_variants WHERE id = 'kht-001-xl'").get()!.stock,
    6,
  )
  assert.ok(
    database
      .prepare("SELECT inventory_restored_at FROM orders WHERE id = 'local-order-1006'")
      .get()!.inventory_restored_at,
  )
})
