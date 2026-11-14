import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { createTestD1 } from './helpers/sqliteD1.ts'
import { saveCartSnapshot, listAbandonedCarts } from '../server/services/abandonedCarts.ts'
import {
  captureAdminNotifications,
  deliverAdminNotifications,
  queueOrderNotification,
} from '../server/services/adminEmailNotifications.ts'

function setup(includeLatest = true) {
  const result = createTestD1()
  const directory = new URL('../server/db/migrations/', import.meta.url)
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.sql')).sort()) {
    if (includeLatest || file !== '0018_admin_email_notifications.sql')
      result.sqlite.exec(readFileSync(new URL(file, directory), 'utf8'))
  }
  return result
}

function insertOrder(sqlite: ReturnType<typeof setup>['sqlite'], id: string) {
  sqlite.prepare(
    `INSERT INTO customers(id,name,phone,address,governorate,city)
     VALUES(?,?,?,?,?,?)`,
  ).run(`customer-${id}`, 'Customer', `01${id.padStart(9, '0').slice(-9)}`, 'Street', 'Cairo', 'Cairo')
  sqlite.prepare(
    `INSERT INTO orders(id,number,public_reference,idempotency_key,customer_id,subtotal,shipping,
      shipping_governorate,total,payment_method,source,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(id, `KHT-${id}`, `KHT-TEST-${id}`, `request-${id}`, `customer-${id}`, 2050, 60,
    'Cairo', 2110,
    'cod', 'website', new Date().toISOString())
}

test('five-minute cart detection excludes active, cleared and converted carts', async () => {
  const { database, sqlite, close } = setup()
  try {
    for (const id of ['000000000001', '000000000002', '000000000003']) {
      await saveCartSnapshot(database, {
        cartId: `00000000-0000-4000-8000-${id}`,
        items: [{ id: 'kht-001', size: 'M', quantity: 1 }],
      })
    }
    sqlite.prepare("UPDATE abandoned_carts SET last_activity=datetime('now','-6 minutes') WHERE id LIKE '%000000000001'").run()
    sqlite.prepare("UPDATE abandoned_carts SET state='cleared',items_count=0,last_activity=datetime('now','-6 minutes') WHERE id LIKE '%000000000003'").run()
    const carts = await listAbandonedCarts(database)
    assert.equal(carts.length, 1)
    assert.match(carts[0]!.id, /000000000001$/)
    await captureAdminNotifications(database)
    await captureAdminNotifications(database)
    assert.equal((sqlite.prepare("SELECT COUNT(*) AS n FROM admin_email_notifications WHERE kind='abandoned_cart'").get() as { n: number }).n, 1)
  } finally {
    close()
  }
})

test('one order and one abandoned cart each send one free-recipient alert', async () => {
  const { database, sqlite, close } = setup()
  const sent: { to: string; from: string; subject: string; text?: string }[] = []
  try {
    insertOrder(sqlite, '1')
    await queueOrderNotification(database, '1')
    await queueOrderNotification(database, '1')
    const cartId = '00000000-0000-4000-8000-000000000001'
    await saveCartSnapshot(database, { cartId, items: [{ id: 'kht-001', size: 'M', quantity: 1 }] })
    sqlite.prepare("UPDATE abandoned_carts SET last_activity=datetime('now','-6 minutes') WHERE id=?").run(cartId)
    await captureAdminNotifications(database)
    const config = {
      ALERT_EMAIL: { async send(message: (typeof sent)[number]) { sent.push(message) } },
      MAIL_FROM: 'no-reply@kht.tknology.online',
      ADMIN_ALERT_EMAIL: 'owner@example.com',
    }
    await deliverAdminNotifications(database, config)
    await deliverAdminNotifications(database, config)
    assert.equal(sent.length, 2)
    assert.ok(sent.every((message) => message.to === 'owner@example.com'))
    assert.ok(sent.some((message) => message.text?.includes('/admin/orders/1')))
    assert.ok(sent.some((message) => message.text?.includes(`/admin/abandoned-carts/${cartId}`)))
    assert.ok(sent.every((message) => !message.text?.includes('Customer')))
    assert.equal((sqlite.prepare("SELECT COUNT(*) AS n FROM admin_email_notifications WHERE state='sent'").get() as { n: number }).n, 2)
  } finally {
    close()
  }
})

test('email failure leaves a retry and never changes the order', async () => {
  const { database, sqlite, close } = setup()
  const originalWarn = console.warn
  const warnings: string[] = []
  try {
    insertOrder(sqlite, '2')
    await queueOrderNotification(database, '2')
    console.warn = (...parts) => warnings.push(JSON.stringify(parts))
    await deliverAdminNotifications(database, {
      ALERT_EMAIL: { async send() { throw new Error('private failure detail') } },
      MAIL_FROM: 'no-reply@kht.tknology.online',
      ADMIN_ALERT_EMAIL: 'owner@example.com',
    })
    const row = sqlite.prepare("SELECT state,attempts FROM admin_email_notifications WHERE kind='order' AND entity_id='2'").get() as { state: string; attempts: number }
    assert.equal(row.state, 'pending')
    assert.equal(row.attempts, 1)
    assert.equal((sqlite.prepare("SELECT COUNT(*) AS n FROM orders WHERE id='2'").get() as { n: number }).n, 1)
    assert.doesNotMatch(warnings.join(' '), /private failure detail|Customer|no-reply/)
  } finally {
    console.warn = originalWarn
    close()
  }
})

test('reactivated cart is not emailed until it becomes inactive again', async () => {
  const { database, sqlite, close } = setup()
  const sent: unknown[] = []
  try {
    const cartId = '00000000-0000-4000-8000-000000000004'
    await saveCartSnapshot(database, { cartId, items: [{ id: 'kht-001', size: 'M', quantity: 1 }] })
    sqlite.prepare("UPDATE abandoned_carts SET last_activity=datetime('now','-6 minutes') WHERE id=?").run(cartId)
    await captureAdminNotifications(database)
    sqlite.prepare('UPDATE abandoned_carts SET last_activity=? WHERE id=?').run(new Date().toISOString(), cartId)
    const config = {
      ALERT_EMAIL: { async send(message: unknown) { sent.push(message) } },
      MAIL_FROM: 'no-reply@kht.tknology.online',
      ADMIN_ALERT_EMAIL: 'owner@example.com',
    }
    await deliverAdminNotifications(database, config)
    assert.equal(sent.length, 0)
    sqlite.prepare("UPDATE abandoned_carts SET last_activity=datetime('now','-6 minutes') WHERE id=?").run(cartId)
    sqlite.prepare("UPDATE admin_email_notifications SET next_attempt_at=datetime('now','-1 minute') WHERE entity_id=?").run(cartId)
    await deliverAdminNotifications(database, config)
    assert.equal(sent.length, 1)
  } finally {
    close()
  }
})

test('migration marks preexisting orders and already abandoned carts as notified', async () => {
  const { database, sqlite, close } = setup(false)
  try {
    insertOrder(sqlite, '3')
    const cartId = '00000000-0000-4000-8000-000000000003'
    await saveCartSnapshot(database, { cartId, items: [{ id: 'kht-001', size: 'M', quantity: 1 }] })
    sqlite.prepare("UPDATE abandoned_carts SET last_activity=datetime('now','-6 minutes') WHERE id=?").run(cartId)
    sqlite.exec(readFileSync(new URL('../server/db/migrations/0018_admin_email_notifications.sql', import.meta.url), 'utf8'))
    await captureAdminNotifications(database)
    assert.equal((sqlite.prepare("SELECT COUNT(*) AS n FROM admin_email_notifications WHERE state='sent'").get() as { n: number }).n, 2)
    assert.equal((sqlite.prepare("SELECT COUNT(*) AS n FROM admin_email_notifications WHERE state='pending'").get() as { n: number }).n, 0)
  } finally {
    close()
  }
})
