import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import {
  allowedFulfillmentTransitions,
  restockReturnedOrder,
  transitionOrder,
} from '../server/services/orderTransitions.ts'
import { getAdminOrder } from '../server/services/adminOrders.ts'
import { createStorefrontOrder } from '../server/services/storefrontCheckout.ts'
import type { StorefrontCheckoutInput } from '../shared/storefrontOrder.ts'
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

function checkoutInput(): StorefrontCheckoutInput {
  return {
    requestId: crypto.randomUUID(),
    cartId: crypto.randomUUID(),
    customer: {
      name: 'Order Operator Test',
      phone: '01010000001',
      address: '12 Test Street',
      governorate: 'Cairo',
      city: 'Nasr City',
    },
    items: [{ id: 'kht-001', size: 'M', quantity: 2 }],
    shippingGovernorate: 'Cairo',
    paymentMethod: 'cod',
  }
}

function orderRow(sqlite: ReturnType<typeof createTestD1>['sqlite'], id: string) {
  return sqlite
    .prepare(
      `SELECT fulfillment_status AS fulfillmentStatus, payment_status AS paymentStatus,
        inventory_restored_at AS inventoryRestoredAt,
        returned_restocked_at AS returnedRestockedAt
       FROM orders WHERE id = ?`,
    )
    .get(id) as {
    fulfillmentStatus: string
    paymentStatus: string
    inventoryRestoredAt: string | null
    returnedRestockedAt: string | null
  }
}

function stock(sqlite: ReturnType<typeof createTestD1>['sqlite']) {
  return (
    sqlite.prepare(`SELECT stock FROM inventory_variants WHERE id = 'kht-001-m'`).get() as {
      stock: number
    }
  ).stock
}

function metaOutboxEvent(
  sqlite: ReturnType<typeof createTestD1>['sqlite'],
  eventName: 'Purchase' | 'OrderConfirmed' | 'OrderDelivered',
) {
  const row = sqlite
    .prepare(
      `SELECT event_id AS eventId, payload_json AS payloadJson
       FROM meta_event_outbox WHERE event_name = ?`,
    )
    .get(eventName) as { eventId: string; payloadJson: string } | undefined
  return row
    ? { eventId: row.eventId, payload: JSON.parse(row.payloadJson) as Record<string, unknown> }
    : undefined
}

function seedPurchaseMetaEvent(
  sqlite: ReturnType<typeof createTestD1>['sqlite'],
  reference: string,
) {
  const payload = {
    event_name: 'Purchase',
    event_time: 1_795_210_000,
    event_id: reference,
    action_source: 'website',
    event_source_url: 'https://kht-eg.com/order-confirmation',
    user_data: { fbp: 'fb.1.1795210000.1234567890' },
    custom_data: {
      currency: 'EGP',
      value: 2800,
      content_ids: ['KHT-001'],
      contents: [{ id: 'KHT-001', quantity: 2, item_price: 1400 }],
      num_items: 2,
      order_id: reference,
    },
  }
  sqlite
    .prepare(
      `INSERT INTO meta_event_outbox
       (event_name, event_id, payload_json, next_attempt_at, created_at)
       VALUES ('Purchase', ?, ?, '2026-11-21T00:00:00.000Z', '2026-11-21T00:00:00.000Z')`,
    )
    .run(reference, JSON.stringify(payload))
}

test('only valid fulfillment transitions are advertised', () => {
  assert.deepEqual(allowedFulfillmentTransitions('pending'), ['confirmed', 'cancelled'])
  assert.deepEqual(allowedFulfillmentTransitions('confirmed'), ['processing', 'cancelled'])
  assert.deepEqual(allowedFulfillmentTransitions('processing'), ['shipped', 'cancelled'])
  assert.deepEqual(allowedFulfillmentTransitions('shipped'), ['out-for-delivery'])
  assert.deepEqual(allowedFulfillmentTransitions('out-for-delivery'), ['delivered'])
  assert.deepEqual(allowedFulfillmentTransitions('delivered'), ['returned'])
  assert.deepEqual(allowedFulfillmentTransitions('cancelled'), [])
  assert.deepEqual(allowedFulfillmentTransitions('returned'), [])
})

test('cancelling restores reserved stock and marks pending COD failed exactly once', async () => {
  const { database, sqlite, close } = setup()
  try {
    await createStorefrontOrder(database, checkoutInput())
    const order = sqlite.prepare('SELECT id FROM orders').get() as { id: string }
    const reservedStock = stock(sqlite)

    await transitionOrder(database, order.id, 'cancelled', 'admin@kht.local', 'Customer declined')

    const cancelled = orderRow(sqlite, order.id)
    assert.equal(cancelled.fulfillmentStatus, 'cancelled')
    assert.equal(cancelled.paymentStatus, 'failed')
    assert.ok(cancelled.inventoryRestoredAt)
    assert.equal(stock(sqlite), reservedStock + 2)

    const detail = await getAdminOrder(order.id, database)
    assert.equal(detail.capabilities.statusTransitions, true)
    assert.deepEqual(detail.order?.allowedFulfillmentTransitions, [])
    assert.equal(detail.order?.canRestockReturned, false)
    assert.equal(detail.order?.events.length, 2)
    await assert.rejects(
      () => transitionOrder(database, order.id, 'cancelled', 'admin@kht.local'),
      /ORDER_TRANSITION_CONFLICT/,
    )
    assert.equal(stock(sqlite), reservedStock + 2)

    const event = sqlite
      .prepare(
        `SELECT event_type AS eventType, from_value AS fromValue, to_value AS toValue,
          actor_email AS actorEmail, note FROM order_events
         WHERE order_id = ? AND event_type = 'fulfillment_status'`,
      )
      .get(order.id) as Record<string, string>
    assert.deepEqual(
      { ...event },
      {
        eventType: 'fulfillment_status',
        fromValue: 'pending',
        toValue: 'cancelled',
        actorEmail: 'admin@kht.local',
        note: 'Customer declined',
      },
    )
  } finally {
    close()
  }
})

test('delivering a COD order marks payment paid and terminal states reject changes', async () => {
  const { database, sqlite, close } = setup()
  try {
    await createStorefrontOrder(database, checkoutInput())
    const { id } = sqlite.prepare('SELECT id FROM orders').get() as { id: string }

    await transitionOrder(database, id, 'confirmed', 'admin@kht.local')
    await transitionOrder(database, id, 'processing', 'admin@kht.local')
    await transitionOrder(database, id, 'shipped', 'admin@kht.local')
    await transitionOrder(database, id, 'out-for-delivery', 'admin@kht.local')
    await transitionOrder(database, id, 'delivered', 'admin@kht.local')

    assert.deepEqual(
      { ...orderRow(sqlite, id) },
      {
        fulfillmentStatus: 'delivered',
        paymentStatus: 'paid',
        inventoryRestoredAt: null,
        returnedRestockedAt: null,
      },
    )
    await transitionOrder(database, id, 'returned', 'admin@kht.local')
    await assert.rejects(
      () => transitionOrder(database, id, 'cancelled', 'admin@kht.local'),
      /ORDER_TRANSITION_CONFLICT/,
    )
    assert.equal(
      (
        sqlite
          .prepare(
            `SELECT COUNT(*) AS count FROM order_events WHERE event_type = 'fulfillment_status'`,
          )
          .get() as { count: number }
      ).count,
      6,
    )
  } finally {
    close()
  }
})

test('confirming an order queues one deterministic Meta event from its Purchase payload', async () => {
  const { database, sqlite, close } = setup()
  try {
    const created = await createStorefrontOrder(database, checkoutInput())
    const { id } = sqlite.prepare('SELECT id FROM orders').get() as { id: string }
    seedPurchaseMetaEvent(sqlite, created.reference)
    const purchase = metaOutboxEvent(sqlite, 'Purchase')
    assert.ok(purchase)

    const transition = await transitionOrder(database, id, 'confirmed', 'admin@kht.local')

    const confirmed = metaOutboxEvent(sqlite, 'OrderConfirmed')
    assert.ok(confirmed)
    assert.equal(confirmed.eventId, `${created.reference}:confirmed`)
    assert.deepEqual(confirmed.payload, {
      ...purchase.payload,
      event_name: 'OrderConfirmed',
      event_id: `${created.reference}:confirmed`,
      event_time: (confirmed.payload as { event_time: number }).event_time,
    })
    assert.deepEqual(transition.analyticsEvent, {
      eventName: 'OrderConfirmed',
      eventId: `${created.reference}:confirmed`,
    })
    assert.ok(metaOutboxEvent(sqlite, 'Purchase'))

    await assert.rejects(
      () => transitionOrder(database, id, 'confirmed', 'admin@kht.local'),
      /ORDER_TRANSITION_CONFLICT/,
    )
    assert.equal(
      (
        sqlite
          .prepare(
            `SELECT COUNT(*) AS count FROM meta_event_outbox WHERE event_name='OrderConfirmed'`,
          )
          .get() as { count: number }
      ).count,
      1,
    )
  } finally {
    close()
  }
})

test('delivering an order queues one deterministic Meta delivery event', async () => {
  const { database, sqlite, close } = setup()
  try {
    const created = await createStorefrontOrder(database, checkoutInput())
    const { id } = sqlite.prepare('SELECT id FROM orders').get() as { id: string }
    seedPurchaseMetaEvent(sqlite, created.reference)
    await transitionOrder(database, id, 'confirmed', 'admin@kht.local')
    await transitionOrder(database, id, 'processing', 'admin@kht.local')
    await transitionOrder(database, id, 'shipped', 'admin@kht.local')
    await transitionOrder(database, id, 'out-for-delivery', 'admin@kht.local')

    const transition = await transitionOrder(database, id, 'delivered', 'admin@kht.local')

    const delivered = metaOutboxEvent(sqlite, 'OrderDelivered')
    assert.ok(delivered)
    assert.equal(delivered.eventId, `${created.reference}:delivered`)
    assert.equal(delivered.payload.event_name, 'OrderDelivered')
    assert.equal(delivered.payload.event_id, `${created.reference}:delivered`)
    assert.deepEqual(transition.analyticsEvent, {
      eventName: 'OrderDelivered',
      eventId: `${created.reference}:delivered`,
    })
    assert.equal(metaOutboxEvent(sqlite, 'Purchase')?.payload, null)
  } finally {
    close()
  }
})

test('returned stock is restored only after one explicit inspection action', async () => {
  const { database, sqlite, close } = setup()
  try {
    await createStorefrontOrder(database, checkoutInput())
    const { id } = sqlite.prepare('SELECT id FROM orders').get() as { id: string }
    const reservedStock = stock(sqlite)
    await transitionOrder(database, id, 'confirmed', 'admin@kht.local')
    await transitionOrder(database, id, 'processing', 'admin@kht.local')
    await transitionOrder(database, id, 'shipped', 'admin@kht.local')
    await transitionOrder(database, id, 'out-for-delivery', 'admin@kht.local')
    await transitionOrder(database, id, 'delivered', 'admin@kht.local')
    await transitionOrder(database, id, 'returned', 'admin@kht.local')

    assert.equal(stock(sqlite), reservedStock)
    assert.equal(orderRow(sqlite, id).returnedRestockedAt, null)
    assert.equal((await getAdminOrder(id, database)).order?.canRestockReturned, true)

    await restockReturnedOrder(database, id, 'admin@kht.local', 'Items passed inspection')

    assert.equal(stock(sqlite), reservedStock + 2)
    assert.ok(orderRow(sqlite, id).returnedRestockedAt)
    assert.equal((await getAdminOrder(id, database)).order?.canRestockReturned, false)
    await assert.rejects(
      () => restockReturnedOrder(database, id, 'admin@kht.local'),
      /ORDER_RESTOCK_CONFLICT/,
    )
    assert.equal(stock(sqlite), reservedStock + 2)
    const event = sqlite
      .prepare(
        `SELECT event_type AS eventType, note FROM order_events WHERE event_type = 'inventory_restocked'`,
      )
      .get() as { eventType: string; note: string }
    assert.deepEqual(
      { ...event },
      { eventType: 'inventory_restocked', note: 'Items passed inspection' },
    )
  } finally {
    close()
  }
})

test('order workflow endpoints require Admin authentication and the detail UI operates server actions', () => {
  const patchRoute = readFileSync(
    new URL('../server/api/admin/orders/[id].patch.ts', import.meta.url),
    'utf8',
  )
  const restockRoute = readFileSync(
    new URL('../server/api/admin/orders/[id]/restock.post.ts', import.meta.url),
    'utf8',
  )
  const page = readFileSync(
    new URL('../app/pages/admin/orders/[id]/index.vue', import.meta.url),
    'utf8',
  )

  assert.match(patchRoute, /requireAdmin\(event\)/)
  assert.match(restockRoute, /requireAdmin\(event\)/)
  assert.match(page, /allowedFulfillmentTransitions/)
  assert.match(page, /method:\s*'PATCH'/)
  assert.match(page, /restock/)
  assert.match(page, /AdminConfirmDialog/)
  assert.match(page, /order\.events/)
})
