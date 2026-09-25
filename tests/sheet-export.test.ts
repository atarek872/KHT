import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { createStorefrontOrder } from '../server/services/storefrontCheckout.ts'
import { transitionOrder } from '../server/services/orderTransitions.ts'
import { getSheetExportPage, verifySheetSyncToken } from '../server/services/sheetExport.ts'
import { createTestD1 } from './helpers/sqliteD1.ts'

const migrationsDirectory = new URL('../server/db/migrations/', import.meta.url)

test('sheet export reports order lines and current inventory without customer details', async () => {
  const { sqlite, database, close } = createTestD1()
  try {
    for (const name of readdirSync(migrationsDirectory).filter((name) => name.endsWith('.sql')).sort()) {
      sqlite.exec(readFileSync(new URL(name, migrationsDirectory), 'utf8'))
    }
    const order = await createStorefrontOrder(database, {
      requestId: crypto.randomUUID(),
      cartId: crypto.randomUUID(),
      customer: {
        name: 'Private Customer', phone: '01012223334', email: 'private@example.test',
        address: 'Private Address', governorate: 'Cairo', city: 'Nasr City',
      },
      items: [{ id: 'kht-001', size: 'M', quantity: 2 }],
      shippingGovernorate: 'Cairo', paymentMethod: 'cod',
    })
    const saved = sqlite.prepare('SELECT id FROM orders WHERE public_reference = ?').get(order.reference) as { id: string }
    for (const status of ['confirmed', 'processing', 'shipped', 'out-for-delivery', 'delivered'] as const) {
      await transitionOrder(database, saved.id, status, 'admin@kht.local')
    }

    const page = await getSheetExportPage(database, 0, 1)
    assert.equal(page.orders.length, 1)
    assert.equal(page.orders[0]?.sku, 'KHT-001-M')
    assert.equal(page.orders[0]?.quantity, 2)
    assert.equal(page.orders[0]?.orderStatus, 'delivered')
    assert.equal(page.orders[0]?.paymentStatus, 'paid')
    assert.ok(page.inventory.some((variant) => variant.sku === 'KHT-001-M' && variant.stock === 10))
    assert.doesNotMatch(JSON.stringify(page), /Private Customer|private@example|Private Address|01012223334/)
    assert.equal((await getSheetExportPage(database, page.nextCursor!, 1)).orders.length, 0)
  } finally {
    close()
  }
})

test('sheet export token check rejects missing and incorrect credentials', async () => {
  const token = 'a'.repeat(64)
  assert.equal(await verifySheetSyncToken(token, token), true)
  assert.equal(await verifySheetSyncToken('b'.repeat(64), token), false)
  assert.equal(await verifySheetSyncToken('', token), false)
  assert.equal(await verifySheetSyncToken(token, ''), false)
})
