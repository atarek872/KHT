import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  getAbandonedCart,
  saveCartSnapshot,
  updateRecoveryState,
} from '../server/services/abandonedCarts.ts'
import { createStorefrontOrder } from '../server/services/storefrontCheckout.ts'
import { createTestD1 } from './helpers/sqliteD1.ts'

const migrations = [
  '0001_commerce.sql',
  '0002_products.sql',
  '0003_categories.sql',
  '0004_discounts.sql',
  '0005_abandoned_carts.sql',
  '0006_commerce_safety.sql',
  '0007_production_commerce.sql',
].map((name) => new URL(`../server/db/migrations/${name}`, import.meta.url))

function setup() {
  const result = createTestD1()
  for (const migration of migrations) result.sqlite.exec(readFileSync(migration, 'utf8'))
  return result
}

const items = [{ id: 'kht-001', size: 'M', quantity: 1 }]

test('checkout contact makes an abandoned cart actionable without later cart updates erasing it', async () => {
  const { database, close } = setup()
  try {
    const cartId = crypto.randomUUID()
    await saveCartSnapshot(database, {
      cartId,
      items,
      contact: { name: 'Mona', phone: '01012345678', email: 'MONA@EXAMPLE.COM' },
    })
    await saveCartSnapshot(database, { cartId, items })
    const cart = await getAbandonedCart(database, cartId)
    assert.equal(cart?.customerName, 'Mona')
    assert.equal(cart?.phone, '201012345678')
    assert.equal(cart?.email, 'mona@example.com')
    assert.equal(cart?.recoveryState, 'active')
    assert.ok(cart?.contactCapturedAt)
  } finally {
    close()
  }
})

test('contact snapshots reject unusable or malformed contact details', async () => {
  const { database, close } = setup()
  try {
    await assert.rejects(
      () =>
        saveCartSnapshot(database, {
          cartId: crypto.randomUUID(),
          items,
          contact: { name: 'Only a name' },
        }),
      /valid phone or email/,
    )
    await assert.rejects(() =>
      saveCartSnapshot(database, {
        cartId: crypto.randomUUID(),
        items,
        contact: { phone: '123', email: 'not-email' },
      }),
    )
  } finally {
    close()
  }
})

test('manual recovery changes are audited and terminal states reject repeats', async () => {
  const { database, sqlite, close } = setup()
  try {
    const cartId = crypto.randomUUID()
    await saveCartSnapshot(database, { cartId, items, contact: { phone: '01012345678' } })
    await updateRecoveryState(database, cartId, 'contacted', 'admin@kht.local', 'WhatsApp sent')
    await updateRecoveryState(
      database,
      cartId,
      'recovered',
      'admin@kht.local',
      'Customer reordered',
    )
    const cart = await getAbandonedCart(database, cartId)
    assert.equal(cart?.recoveryState, 'recovered')
    assert.equal(cart?.events.length, 2)
    assert.equal(
      (
        sqlite
          .prepare('SELECT COUNT(*) AS count FROM abandoned_cart_events WHERE cart_id = ?')
          .get(cartId) as { count: number }
      ).count,
      2,
    )
    await assert.rejects(
      () => updateRecoveryState(database, cartId, 'contacted', 'admin@kht.local'),
      /CART_RECOVERY_CONFLICT/,
    )
  } finally {
    close()
  }
})

test('anonymous carts cannot be falsely marked contacted or recovered', async () => {
  const { database, close } = setup()
  try {
    const cartId = crypto.randomUUID()
    await saveCartSnapshot(database, { cartId, items })
    await assert.rejects(
      () => updateRecoveryState(database, cartId, 'contacted', 'admin@kht.local'),
      /CART_CONTACT_REQUIRED/,
    )
    await assert.rejects(
      () => updateRecoveryState(database, cartId, 'recovered', 'admin@kht.local'),
      /CART_CONTACT_REQUIRED/,
    )
  } finally {
    close()
  }
})

test('successful checkout converts and audits the matching cart atomically', async () => {
  const { database, sqlite, close } = setup()
  try {
    const cartId = crypto.randomUUID()
    await saveCartSnapshot(database, { cartId, items, contact: { phone: '01012345678' } })
    await createStorefrontOrder(database, {
      requestId: crypto.randomUUID(),
      cartId,
      customer: {
        name: 'Mona',
        phone: '01012345678',
        address: 'Street 1',
        governorate: 'Cairo',
        city: 'Cairo',
      },
      items,
      shippingGovernorate: 'Cairo',
      paymentMethod: 'cod',
    })
    const row = sqlite
      .prepare(
        'SELECT state, recovery_state AS recoveryState, recovered_order_id AS orderId FROM abandoned_carts WHERE id = ?',
      )
      .get(cartId) as Record<string, string>
    assert.equal(row.state, 'converted')
    assert.equal(row.recoveryState, 'converted')
    assert.ok(row.orderId)
    assert.equal(
      (
        sqlite
          .prepare(
            "SELECT COUNT(*) AS count FROM abandoned_cart_events WHERE cart_id = ? AND to_state = 'converted'",
          )
          .get(cartId) as { count: number }
      ).count,
      1,
    )
  } finally {
    close()
  }
})

test('Admin recovery endpoint and UI expose contact actions only for contactable carts', () => {
  const route = readFileSync(
    new URL('../server/api/admin/abandoned-carts/[id].patch.ts', import.meta.url),
    'utf8',
  )
  const page = readFileSync(
    new URL('../app/pages/admin/abandoned-carts/[id].vue', import.meta.url),
    'utf8',
  )
  const checkout = readFileSync(new URL('../app/pages/checkout.vue', import.meta.url), 'utf8')
  assert.match(route, /requireAdmin\(event\)/)
  assert.match(page, /wa\.me/)
  assert.match(page, /mailto:/)
  for (const action of ['Mark contacted', 'Mark recovered', 'Dismiss'])
    assert.match(page, new RegExp(action))
  assert.match(page, /v-if="cart\.phone \|\| cart\.email"/)
  assert.match(checkout, /600/)
  assert.match(checkout, /snapshotContact/)
})
