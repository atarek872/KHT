import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { testDatabase } from './d1-test-adapter.ts'
import { getSavedCart, writeSavedCart, mergeGuestCart } from '../server/services/customerCarts.ts'

test('cart schema supports owned active carts, versioning and unique merge receipts', () => {
  const db = new DatabaseSync(':memory:')
  const directory = new URL('../server/db/migrations/', import.meta.url)
  for (const file of readdirSync(directory)
    .filter((f) => f.endsWith('.sql') && f <= '0008_persistent_carts.sql')
    .sort())
    db.exec(readFileSync(new URL(file, directory), 'utf8'))
  const columns = db
    .prepare('PRAGMA table_info(abandoned_carts)')
    .all()
    .map((row) => row.name)
  assert.ok(columns.includes('user_id'), 'cart must belong to an authenticated user')
  assert.ok(columns.includes('version'), 'cart must detect concurrent changes')
  db.exec(
    "INSERT INTO customer_users(id,name,email,password_hash) VALUES('u','User','u@example.com','hash')",
  )
  db.exec("INSERT INTO abandoned_carts(id,user_id) VALUES('cart','u')")
  assert.throws(
    () => db.exec("INSERT INTO abandoned_carts(id,user_id) VALUES('other','u')"),
    /UNIQUE/,
  )
  assert.equal(
    db.prepare("SELECT value FROM commerce_settings WHERE key='abandonment_minutes'").get()?.value,
    '30',
  )
  db.close()
})

test('saved carts restore, reprice, reject stale writes and merge a guest exactly once', async () => {
  const { database, sql } = testDatabase()
  const user = { id: 'user', name: 'Buyer', email: 'buyer@example.com', phone: '01000000000' }
  sql
    .prepare('INSERT INTO customer_users(id,name,email,phone,password_hash) VALUES(?,?,?,?,?)')
    .run(user.id, user.name, user.email, user.phone, 'hash')
  const empty = await getSavedCart(database, { user })
  const saved = await writeSavedCart(
    database,
    { user },
    { ...empty, items: [{ id: 'kht-001', size: 'M', quantity: 2 }] },
  )
  assert.equal(saved.subtotal, 1780)
  assert.deepEqual((await getSavedCart(database, { user })).items, saved.items)
  await assert.rejects(writeSavedCart(database, { user }, { ...empty, items: [] }), /CART_CHANGED/)
  const merged = await mergeGuestCart(database, user, 'guest', [
    { id: 'kht-001', size: 'M', quantity: 1 },
  ])
  assert.equal(merged.items[0]?.quantity, 3)
  const retry = await mergeGuestCart(database, user, 'guest', [
    { id: 'kht-001', size: 'M', quantity: 1 },
  ])
  assert.equal(retry.items[0]?.quantity, 3)
  assert.equal(retry.version, merged.version)
  const row = sql
    .prepare('SELECT user_id,email,phone FROM abandoned_carts WHERE id=?')
    .get(saved.id)
  assert.equal(row?.user_id, user.id)
  assert.equal(row?.email, user.email)
  await assert.rejects(
    writeSavedCart(database, { guestHash: 'intruder' }, { ...saved, items: [] }),
    /CART_CHANGED/,
  )
  sql.close()
})
