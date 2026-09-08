import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import assert from 'node:assert/strict'
const db = new DatabaseSync(':memory:')
const dir = new URL('../server/db/migrations/', import.meta.url)
for (const file of readdirSync(dir).sort()) db.exec(readFileSync(new URL(file, dir), 'utf8'))
assert.ok(
  db
    .prepare('PRAGMA table_info(orders)')
    .all()
    .some((c) => c.name === 'user_id'),
  'Order ownership migration must exist',
)
db.exec(
  "INSERT INTO customer_users(id,name,email,password_hash) VALUES('u','One','one@test.test','hash'),('v','Two','two@test.test','hash'); INSERT INTO customers(id,name,phone,address,city,governorate) VALUES('c','Original','123','Street','City','Cairo'); INSERT INTO abandoned_carts(id,user_id,version,items_count) VALUES('cart','u',1,1)",
)
const insert = db.prepare(
  `INSERT INTO orders(id,number,idempotency_key,customer_id,user_id,cart_id,cart_version,subtotal,shipping,total,payment_method,source,shipping_governorate) VALUES(?,?,?,'c',?,'cart',?,890,60,950,'cod','website','Cairo')`,
)
assert.throws(() => insert.run('bad', 'bad', 'bad', 'v', 1), /CART_CHANGED/)
assert.throws(() => insert.run('stale', 'stale', 'stale', 'u', 0), /CART_CHANGED/)
db.exec('BEGIN')
insert.run('rollback', 'rollback', 'rollback', 'u', 1)
assert.throws(
  () =>
    db.exec(
      "INSERT INTO order_items VALUES('bad','rollback','kht-001-xxl','Tee','XXL','KHT-001-XXL',1,890,890)",
    ),
  /INSUFFICIENT_STOCK/,
)
db.exec('ROLLBACK')
assert.equal(db.prepare("SELECT state FROM abandoned_carts WHERE id='cart'").get().state, 'active')
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM order_status_history').get().n, 0)
insert.run('o', 'O', 'key', 'u', 1)
db.exec("INSERT INTO order_items VALUES('i','o','kht-001-s','Tee','S','KHT-001-S',1,890,890)")
assert.equal(db.prepare("SELECT version FROM abandoned_carts WHERE id='cart'").get().version, 2)
assert.equal(db.prepare("SELECT id FROM orders WHERE id='o' AND user_id='v'").get(), undefined)
db.exec("UPDATE customers SET name='Changed' WHERE id='c'")
assert.equal(
  JSON.parse(
    db.prepare("SELECT shipping_snapshot FROM orders WHERE id='o'").get().shipping_snapshot,
  ).name,
  'Original',
)
assert.throws(
  () => db.exec("UPDATE orders SET fulfillment_status='delivered' WHERE id='o'"),
  /INVALID_FULFILLMENT_TRANSITION/,
)
for (const status of [
  'confirmed',
  'processing',
  'shipped',
  'out-for-delivery',
  'delivered',
  'returned',
])
  db.prepare("UPDATE orders SET fulfillment_status=? WHERE id='o'").run(status)
assert.equal(db.prepare("SELECT stock FROM inventory_variants WHERE id='kht-001-s'").get().stock, 8)
db.exec("UPDATE orders SET fulfillment_status='returned' WHERE id='o'")
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM order_status_history').get().n, 7)
assert.equal(db.prepare("SELECT stock FROM inventory_variants WHERE id='kht-001-s'").get().stock, 8)
assert.throws(
  () => db.exec("UPDATE orders SET fulfillment_status='pending' WHERE id='o'"),
  /INVALID_FULFILLMENT_TRANSITION/,
)
console.log(
  'Customer order migration: ownership, cart rollback, snapshots, history and exact-once restock passed',
)
