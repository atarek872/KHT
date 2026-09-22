import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import {
  deleteAdminOrder,
  getAdminOrder,
  listAdminOrders,
} from '../server/services/adminOrders.ts'
import {
  restockReturnedOrder,
  transitionOrder,
} from '../server/services/orderTransitions.ts'
import { deleteAbandonedCart } from '../server/services/abandonedCarts.ts'
import { createStorefrontOrder } from '../server/services/storefrontCheckout.ts'
import type { D1Database } from '../server/utils/d1.ts'
import { createTestD1 } from './helpers/sqliteD1.ts'

const migrationDirectory = new URL('../server/db/migrations/', import.meta.url)
const migrations = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => new URL(name, migrationDirectory))

function setup() {
  const testDatabase = createTestD1()
  for (const migration of migrations) {
    testDatabase.sqlite.exec(readFileSync(migration, 'utf8'))
  }
  return testDatabase
}

function checkoutInput(phone = '01010000009') {
  return {
    requestId: crypto.randomUUID(),
    cartId: crypto.randomUUID(),
    customer: {
      name: 'Permanent Delete Test',
      phone,
      address: '12 Test Street',
      governorate: 'Cairo',
      city: 'Nasr City',
    },
    items: [{ id: 'kht-001', size: 'M', quantity: 1 }],
    shippingGovernorate: 'Cairo',
    paymentMethod: 'cod' as const,
  }
}

function count(
  sqlite: ReturnType<typeof createTestD1>['sqlite'],
  table: string,
  column: string,
  value: string,
) {
  return Number(
    (
      sqlite
        .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} = ?`)
        .get(value) as { count: number }
    ).count,
  )
}

function stock(sqlite: ReturnType<typeof createTestD1>['sqlite']) {
  return Number(
    (
      sqlite.prepare("SELECT stock FROM inventory_variants WHERE id = 'kht-001-m'").get() as {
        stock: number
      }
    ).stock,
  )
}

function order(
  sqlite: ReturnType<typeof createTestD1>['sqlite'],
  offset = 0,
) {
  return sqlite
    .prepare('SELECT id, number FROM orders ORDER BY created_at, rowid LIMIT 1 OFFSET ?')
    .get(offset) as { id: string; number: string }
}

async function deliver(database: D1Database, id: string) {
  await transitionOrder(database, id, 'confirmed', 'admin@kht.local')
  await transitionOrder(database, id, 'processing', 'admin@kht.local')
  await transitionOrder(database, id, 'shipped', 'admin@kht.local')
  await transitionOrder(database, id, 'out-for-delivery', 'admin@kht.local')
  await transitionOrder(database, id, 'delivered', 'admin@kht.local')
}

test('cancelled restored orders delete dependants without changing stock', async () => {
  const { database, sqlite, close } = setup()
  try {
    await createStorefrontOrder(database, checkoutInput())
    const target = order(sqlite)
    await transitionOrder(database, target.id, 'cancelled', 'admin@kht.local')
    const stockBeforeDelete = stock(sqlite)

    await deleteAdminOrder(database, target.id, target.number)

    assert.equal(stock(sqlite), stockBeforeDelete)
    assert.equal(count(sqlite, 'orders', 'id', target.id), 0)
    assert.equal(count(sqlite, 'order_items', 'order_id', target.id), 0)
    assert.equal(count(sqlite, 'order_events', 'order_id', target.id), 0)
    assert.equal(count(sqlite, 'order_status_history', 'order_id', target.id), 0)
  } finally {
    close()
  }
})

test('active, unrestored, missing, and incorrectly confirmed orders are rejected', async () => {
  const { database, sqlite, close } = setup()
  try {
    await createStorefrontOrder(database, checkoutInput())
    const pending = order(sqlite)
    await assert.rejects(
      () => deleteAdminOrder(database, pending.id, pending.number),
      /ORDER_DELETE_CONFLICT/,
    )

    sqlite
      .prepare("UPDATE orders SET fulfillment_status = 'cancelled', inventory_restored_at = NULL WHERE id = ?")
      .run(pending.id)
    await assert.rejects(
      () => deleteAdminOrder(database, pending.id, pending.number),
      /ORDER_DELETE_CONFLICT/,
    )
    await assert.rejects(
      () => deleteAdminOrder(database, pending.id, 'WRONG-NUMBER'),
      /ORDER_DELETE_CONFLICT/,
    )
    await assert.rejects(
      () => deleteAdminOrder(database, 'missing-order', 'KHT-MISSING'),
      /ORDER_NOT_FOUND/,
    )
    assert.equal(count(sqlite, 'orders', 'id', pending.id), 1)
  } finally {
    close()
  }
})

test('delivered and explicitly restocked returned orders are eligible', async () => {
  const { database, sqlite, close } = setup()
  try {
    await createStorefrontOrder(database, checkoutInput('01010000010'))
    const delivered = order(sqlite)
    await deliver(database, delivered.id)

    const detail = await getAdminOrder(delivered.id, database)
    const list = await listAdminOrders(database)
    assert.equal(detail.order?.canDelete, true)
    assert.equal(detail.order?.deleteBlockReason, '')
    assert.equal(list.items.find((item) => item.id === delivered.id)?.canDelete, true)

    await createStorefrontOrder(database, checkoutInput('01010000011'))
    const returned = order(sqlite, 1)
    await deliver(database, returned.id)
    await transitionOrder(database, returned.id, 'returned', 'admin@kht.local')
    await assert.rejects(
      () => deleteAdminOrder(database, returned.id, returned.number),
      /ORDER_DELETE_CONFLICT/,
    )
    assert.match((await getAdminOrder(returned.id, database)).order?.deleteBlockReason || '', /Restock/)
    await restockReturnedOrder(database, returned.id, 'admin@kht.local')

    await deleteAdminOrder(database, returned.id, returned.number)
    await deleteAdminOrder(database, delivered.id, delivered.number)
    assert.equal(count(sqlite, 'orders', 'id', returned.id), 0)
    assert.equal(count(sqlite, 'orders', 'id', delivered.id), 0)
  } finally {
    close()
  }
})

test('stale order status cannot clear recovery references or partially delete', async () => {
  const { database, sqlite, close } = setup()
  try {
    await createStorefrontOrder(database, checkoutInput())
    const target = order(sqlite)
    await deliver(database, target.id)
    sqlite
      .prepare(`INSERT INTO abandoned_carts
        (id, subtotal, items_count, state, recovery_state, recovered_order_id)
        VALUES ('order-delete-reference', 0, 0, 'converted', 'converted', ?)`)
      .run(target.id)

    const staleDatabase: D1Database = {
      prepare: database.prepare.bind(database),
      async batch(statements) {
        sqlite.prepare("UPDATE orders SET fulfillment_status = 'returned' WHERE id = ?").run(target.id)
        return database.batch(statements)
      },
    }

    await assert.rejects(
      () => deleteAdminOrder(staleDatabase, target.id, target.number),
      /ORDER_DELETE_CONFLICT/,
    )
    assert.equal(count(sqlite, 'orders', 'id', target.id), 1)
    assert.equal(
      (
        sqlite
          .prepare('SELECT recovered_order_id AS orderId FROM abandoned_carts WHERE id = ?')
          .get('order-delete-reference') as { orderId: string }
      ).orderId,
      target.id,
    )
  } finally {
    close()
  }
})

test('abandoned cart deletion removes items, events, and merge receipts', async () => {
  const { database, sqlite, close } = setup()
  try {
    sqlite.exec(`
      INSERT INTO customer_users(id, name, email, phone, password_hash)
        VALUES ('delete-cart-user', 'Cart User', 'delete-cart@example.com', '201010000099', 'hash');
      INSERT INTO abandoned_carts(id, user_id, subtotal, items_count, state, recovery_state)
        VALUES ('delete-cart', 'delete-cart-user', 890, 1, 'active', 'contacted');
      INSERT INTO abandoned_cart_items
        (id, cart_id, product_id, variant_id, product_name, variant, image, quantity, unit_price, total)
        VALUES ('delete-cart-item', 'delete-cart', 'kht-001', 'kht-001-m', 'The Line Tee', 'Black / M', '/images/kht-001.webp', 1, 890, 890);
      INSERT INTO abandoned_cart_events(id, cart_id, from_state, to_state, actor_email)
        VALUES ('delete-cart-event', 'delete-cart', 'active', 'contacted', 'admin@kht.local');
      INSERT INTO cart_merge_receipts(guest_key_hash, user_id, cart_id, created_at)
        VALUES ('delete-cart-receipt', 'delete-cart-user', 'delete-cart', CURRENT_TIMESTAMP);
    `)

    await deleteAbandonedCart(database, 'delete-cart')

    assert.equal(count(sqlite, 'abandoned_carts', 'id', 'delete-cart'), 0)
    assert.equal(count(sqlite, 'abandoned_cart_items', 'cart_id', 'delete-cart'), 0)
    assert.equal(count(sqlite, 'abandoned_cart_events', 'cart_id', 'delete-cart'), 0)
    assert.equal(count(sqlite, 'cart_merge_receipts', 'cart_id', 'delete-cart'), 0)
  } finally {
    close()
  }
})

test('abandoned carts linked to orders are preserved and missing carts are reported', async () => {
  const { database, sqlite, close } = setup()
  try {
    const linkedCartId = 'linked-order-cart'
    sqlite.exec(`
      INSERT INTO customer_users(id, name, email, phone, password_hash)
        VALUES ('linked-cart-user', 'Linked Cart User', 'linked-cart@example.com', '201010000098', 'hash');
      INSERT INTO abandoned_carts(id, user_id, subtotal, items_count, state, recovery_state)
        VALUES ('${linkedCartId}', 'linked-cart-user', 890, 1, 'active', 'active');
      INSERT INTO abandoned_cart_items
        (id, cart_id, product_id, variant_id, product_name, variant, image, quantity, unit_price, total)
        VALUES ('linked-cart-item', '${linkedCartId}', 'kht-001', 'kht-001-m', 'The Line Tee', 'Black / M', '/images/kht-001.webp', 1, 890, 890);
      INSERT INTO cart_merge_receipts(guest_key_hash, user_id, cart_id, created_at)
        VALUES ('linked-cart-receipt', 'linked-cart-user', '${linkedCartId}', CURRENT_TIMESTAMP);
    `)
    await createStorefrontOrder(database, checkoutInput())
    const linkedOrder = order(sqlite)
    sqlite.prepare('UPDATE orders SET cart_id = ? WHERE id = ?').run(linkedCartId, linkedOrder.id)

    await assert.rejects(
      () => deleteAbandonedCart(database, linkedCartId),
      /CART_DELETE_CONFLICT/,
    )
    await assert.rejects(
      () => deleteAbandonedCart(database, 'missing-cart'),
      /CART_NOT_FOUND/,
    )
    assert.equal(count(sqlite, 'abandoned_carts', 'id', linkedCartId), 1)
    assert.equal(count(sqlite, 'abandoned_cart_items', 'cart_id', linkedCartId), 1)
    assert.equal(count(sqlite, 'cart_merge_receipts', 'cart_id', linkedCartId), 1)
  } finally {
    close()
  }
})
