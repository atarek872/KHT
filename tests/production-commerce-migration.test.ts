import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { listAbandonedCarts } from '../server/services/abandonedCarts.ts'
import { createTestD1 } from './helpers/sqliteD1.ts'

const migrationUrl = new URL(
  '../server/db/migrations/0007_production_commerce.sql',
  import.meta.url,
)
const baseMigrationUrls = [
  '../server/db/migrations/0001_commerce.sql',
  '../server/db/migrations/0002_products.sql',
  '../server/db/migrations/0003_categories.sql',
  '../server/db/migrations/0004_discounts.sql',
  '../server/db/migrations/0005_abandoned_carts.sql',
  '../server/db/migrations/0006_commerce_safety.sql',
].map((path) => new URL(path, import.meta.url))

function applyBaseMigrations(sqlite: ReturnType<typeof createTestD1>['sqlite']) {
  for (const migration of baseMigrationUrls) sqlite.exec(readFileSync(migration, 'utf8'))
}

test('production commerce migration is present', () => {
  assert.equal(existsSync(migrationUrl), true)
})

test('production migration backfills public references and adds workflow records', () => {
  const { sqlite, close } = createTestD1()
  try {
    applyBaseMigrations(sqlite)
    sqlite.exec(`
      INSERT INTO customers (id, name, phone, email, address, governorate, city)
      VALUES ('customer-before', 'Before Migration', '0100 000 0000', 'before@example.com',
        'Street 1', 'Cairo', 'Nasr City');
      INSERT INTO orders
        (id, number, idempotency_key, customer_id, subtotal, shipping, shipping_governorate,
         total, payment_method, source)
      VALUES ('order-before', 'KHT-BEFORE', 'before-request', 'customer-before', 890, 60,
        'Cairo', 950, 'cod', 'website');
      INSERT INTO abandoned_carts
        (id, customer_name, phone, subtotal, items_count, state)
      VALUES ('cleared-cart', 'Cart Customer', '01111111111', 890, 1, 'cleared');
    `)

    sqlite.exec(readFileSync(migrationUrl, 'utf8'))

    const order = sqlite
      .prepare(
        `
      SELECT public_reference, inventory_restored_at, returned_restocked_at
      FROM orders WHERE id = 'order-before'
    `,
      )
      .get() as Record<string, string | null>
    assert.match(order.public_reference ?? '', /^KHT-BEFORE-[A-F0-9]{8}$/)
    assert.equal(order.inventory_restored_at, null)
    assert.equal(order.returned_restocked_at, null)

    assert.equal(
      (
        sqlite
          .prepare(`SELECT phone_normalized FROM customers WHERE id = 'customer-before'`)
          .get() as {
          phone_normalized: string
        }
      ).phone_normalized,
      '0100 000 0000',
    )
    assert.equal(
      (
        sqlite
          .prepare(`SELECT recovery_state FROM abandoned_carts WHERE id = 'cleared-cart'`)
          .get() as {
          recovery_state: string
        }
      ).recovery_state,
      'dismissed',
    )

    const tables = new Set(
      (
        sqlite.prepare(`SELECT name FROM sqlite_schema WHERE type = 'table'`).all() as {
          name: string
        }[]
      ).map(({ name }) => name),
    )
    for (const table of ['order_events', 'abandoned_cart_events', 'request_rate_limits']) {
      assert.equal(tables.has(table), true, `${table} should exist`)
    }
  } finally {
    close()
  }
})

test('production constraints enforce unique identities and valid workflow states', () => {
  const { sqlite, close } = createTestD1()
  try {
    applyBaseMigrations(sqlite)
    sqlite.exec(readFileSync(migrationUrl, 'utf8'))
    sqlite.exec(`
      INSERT INTO customers
        (id, name, phone, phone_normalized, address, governorate, city)
      VALUES ('customer-one', 'Customer One', '01000000000', '201000000000',
        'Street 1', 'Cairo', 'Nasr City');
      INSERT INTO orders
        (id, number, public_reference, idempotency_key, customer_id, subtotal, shipping,
         shipping_governorate, total, payment_method, source)
      VALUES ('order-one', 'KHT-ONE', 'KHT-PUBLIC-ONE', 'request-one', 'customer-one', 890,
        60, 'Cairo', 950, 'cod', 'website');
    `)

    assert.throws(
      () =>
        sqlite.exec(`INSERT INTO customers
        (id, name, phone, phone_normalized, address, governorate, city)
        VALUES ('customer-two', 'Customer Two', '0100-000-0000', '201000000000',
          'Street 2', 'Cairo', 'Heliopolis')`),
      /UNIQUE constraint failed: customers\.phone_normalized/,
    )
    assert.throws(
      () =>
        sqlite.exec(`INSERT INTO orders
        (id, number, public_reference, idempotency_key, customer_id, subtotal, shipping,
         shipping_governorate, total, payment_method, source)
        VALUES ('order-two', 'KHT-TWO', 'KHT-PUBLIC-ONE', 'request-two', 'customer-one', 890,
          60, 'Cairo', 950, 'cod', 'website')`),
      /UNIQUE constraint failed: orders\.public_reference/,
    )

    sqlite.exec(`UPDATE orders SET fulfillment_status = 'returned' WHERE id = 'order-one'`)
    assert.equal(
      (
        sqlite.prepare(`SELECT fulfillment_status FROM orders WHERE id = 'order-one'`).get() as {
          fulfillment_status: string
        }
      ).fulfillment_status,
      'returned',
    )
    assert.throws(
      () => sqlite.exec(`UPDATE orders SET fulfillment_status = 'lost' WHERE id = 'order-one'`),
      /INVALID_FULFILLMENT_STATUS/,
    )
    assert.throws(
      () =>
        sqlite.exec(`INSERT INTO abandoned_carts
        (id, subtotal, items_count, recovery_state) VALUES ('bad-cart', 0, 0, 'unknown')`),
      /CHECK constraint failed/,
    )
    assert.throws(
      () =>
        sqlite.exec(`INSERT INTO request_rate_limits (key_hash, request_count, expires_at)
        VALUES ('bad-rate', -1, CURRENT_TIMESTAMP)`),
      /CHECK constraint failed/,
    )
  } finally {
    close()
  }
})

test('SQLite D1 adapter batches writes atomically', async () => {
  const { database, sqlite, close } = createTestD1()
  try {
    sqlite.exec('CREATE TABLE sample (id TEXT PRIMARY KEY, value INTEGER NOT NULL)')
    await database.batch([
      database.prepare('INSERT INTO sample (id, value) VALUES (?, ?)').bind('one', 1),
      database.prepare('INSERT INTO sample (id, value) VALUES (?, ?)').bind('two', 2),
    ])
    assert.deepEqual(
      (
        await database
          .prepare('SELECT id, value FROM sample ORDER BY id')
          .all<{ id: string; value: number }>()
      ).results,
      [
        { id: 'one', value: 1 },
        { id: 'two', value: 2 },
      ],
    )

    await assert.rejects(() =>
      database.batch([
        database.prepare('INSERT INTO sample (id, value) VALUES (?, ?)').bind('three', 3),
        database.prepare('INSERT INTO sample (id, value) VALUES (?, ?)').bind('one', 99),
      ]),
    )
    assert.equal(
      (await database.prepare('SELECT COUNT(*) AS count FROM sample').first<{ count: number }>())
        ?.count,
      2,
    )
  } finally {
    close()
  }
})

test('abandoned cart reads use the persisted production recovery state', async () => {
  const { database, sqlite, close } = createTestD1()
  try {
    applyBaseMigrations(sqlite)
    sqlite.exec(readFileSync(migrationUrl, 'utf8'))
    sqlite.exec(`INSERT INTO abandoned_carts
      (id, customer_name, phone, subtotal, items_count, state, recovery_state, last_activity)
      VALUES ('contacted-cart', 'Contacted Customer', '01000000000', 890, 1, 'active',
        'contacted', datetime('now', '-35 minutes'))`)

    const carts = await listAbandonedCarts(database)
    assert.equal(carts.length, 1)
    assert.equal(carts[0]?.recoveryState, 'contacted')
  } finally {
    close()
  }
})
