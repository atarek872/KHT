import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

const database = new DatabaseSync(':memory:')
database.exec(readFileSync(new URL('../server/db/migrations/0001_commerce.sql', import.meta.url), 'utf8'))
database.exec(readFileSync(new URL('../server/db/migrations/0002_products.sql', import.meta.url), 'utf8'))
database.exec(readFileSync(new URL('../server/db/migrations/0003_categories.sql', import.meta.url), 'utf8'))
database.exec(readFileSync(new URL('../server/db/migrations/0004_discounts.sql', import.meta.url), 'utf8'))
database.exec(readFileSync(new URL('../server/db/migrations/0005_abandoned_carts.sql', import.meta.url), 'utf8'))
database.exec(readFileSync(new URL('../server/db/migrations/0006_commerce_safety.sql', import.meta.url), 'utf8'))
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM inventory_variants').get().count, 15)
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM products').get().count, 3)
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM categories').get().count, 3)
assert.deepEqual(
  database.prepare('SELECT name_en AS name FROM categories ORDER BY sort_order').all().map((row) => row.name),
  ['T-shirts', 'Tracksuits', 'Trousers'],
)
assert.deepEqual(
  database.prepare('SELECT governorate, rate FROM shipping_zones ORDER BY governorate').all()
    .map((row) => ({ governorate: row.governorate, rate: row.rate })),
  [
    { governorate: 'Alexandria', rate: 90 },
    { governorate: 'Cairo', rate: 60 },
    { governorate: 'Giza', rate: 70 },
  ],
)
database.exec("UPDATE shipping_zones SET enabled = 0 WHERE governorate = 'Alexandria'")
assert.deepEqual(
  database.prepare('SELECT governorate FROM shipping_zones WHERE enabled = 1 ORDER BY governorate').all()
    .map((row) => ({ governorate: row.governorate })),
  [{ governorate: 'Cairo' }, { governorate: 'Giza' }],
)

database.exec(`
  INSERT INTO customers (id, name, phone, address, governorate, city)
  VALUES ('customer', 'Test Customer', '01000000000', 'Street 1', 'Cairo', 'Nasr City');
  INSERT INTO orders
    (id, number, idempotency_key, customer_id, subtotal, shipping, shipping_governorate,
     total, payment_method, source)
  VALUES ('order', 'KHT-TEST', 'request', 'customer', 2390, 60, 'Cairo', 2450, 'cod', 'admin');
`)

assert.throws(
  () =>
    database.exec(`INSERT INTO order_items
      (id, order_id, variant_id, product_name, variant, sku, quantity, unit_price, total)
      VALUES ('oversell', 'order', 'kht-002-xl', 'Tracksuit', 'Black / XL', 'KHT-002-XL', 5, 2390, 11950)`),
  /INSUFFICIENT_STOCK/,
)
assert.equal(
  database.prepare("SELECT stock FROM inventory_variants WHERE id = 'kht-002-xl'").get().stock,
  4,
)

database.exec(`INSERT INTO order_items
  (id, order_id, variant_id, product_name, variant, sku, quantity, unit_price, total)
  VALUES ('accepted', 'order', 'kht-002-xl', 'Tracksuit', 'Black / XL', 'KHT-002-XL', 2, 2390, 4780)`)
assert.equal(
  database.prepare("SELECT stock FROM inventory_variants WHERE id = 'kht-002-xl'").get().stock,
  2,
)
assert.throws(
  () => database.exec(`INSERT INTO order_items
    (id, order_id, variant_id, product_name, variant, sku, quantity, unit_price, total)
    VALUES ('stale-price', 'order', 'kht-002-xl', 'Tracksuit', 'Black / XL',
      'KHT-002-XL', 1, 1, 1)`),
  /STALE_VARIANT_PRICE/,
)

database.exec(`INSERT INTO discounts
  (id, code, type, value, usage_limit, active) VALUES ('discount', 'ONCE10', 'percentage', 10, 1, 1);
  INSERT INTO orders
    (id, number, idempotency_key, customer_id, subtotal, shipping, shipping_governorate, discount, total,
     payment_method, source, discount_id, discount_code)
  VALUES ('discounted-order', 'KHT-DISCOUNT-1', 'discount-request-1', 'customer', 1000, 60, 'Cairo', 100,
    960, 'cod', 'admin', 'discount', 'ONCE10');`)
assert.equal(database.prepare("SELECT current_usage AS usage FROM discounts WHERE id = 'discount'").get().usage, 1)
assert.throws(
  () => database.exec(`INSERT INTO orders
    (id, number, idempotency_key, customer_id, subtotal, shipping, shipping_governorate, discount, total,
     payment_method, source, discount_id, discount_code)
    VALUES ('discounted-order-2', 'KHT-DISCOUNT-2', 'discount-request-2', 'customer', 1000, 60, 'Cairo',
      100, 960, 'cod', 'admin', 'discount', 'ONCE10')`),
  /DISCOUNT_UNAVAILABLE/,
)

assert.throws(
  () => database.exec(`INSERT INTO orders
    (id, number, idempotency_key, customer_id, subtotal, shipping, shipping_governorate, discount, total,
     payment_method, source)
    VALUES ('bad-total', 'KHT-BAD-TOTAL', 'bad-total', 'customer', 1000, 60, 'Cairo', 0, 999,
      'cod', 'admin')`),
  /INVALID_ORDER_TOTAL/,
)
assert.throws(
  () => database.exec(`INSERT INTO orders
    (id, number, idempotency_key, customer_id, subtotal, shipping, shipping_governorate, discount, total,
     payment_method, payment_status, source)
    VALUES ('paid-cod', 'KHT-PAID-COD', 'paid-cod', 'customer', 1000, 60, 'Cairo', 0, 1060,
      'cod', 'paid', 'admin')`),
  /INVALID_COD_PAYMENT_STATUS/,
)
database.exec(`INSERT INTO discounts
  (id, code, type, value, active) VALUES ('safety-discount', 'SAFE10', 'percentage', 10, 1)`)
assert.throws(
  () => database.exec(`INSERT INTO orders
    (id, number, idempotency_key, customer_id, subtotal, shipping, shipping_governorate, discount, total,
     payment_method, source, discount_id, discount_code)
    VALUES ('bad-discount', 'KHT-BAD-DISCOUNT', 'bad-discount', 'customer', 1000, 60, 'Cairo', 50,
      1010, 'cod', 'admin', 'safety-discount', 'SAFE10')`),
  /INVALID_DISCOUNT_AMOUNT/,
)
assert.throws(
  () => database.exec(`INSERT INTO orders
    (id, number, idempotency_key, customer_id, subtotal, shipping, shipping_governorate,
     discount, total, payment_method, source)
    VALUES ('bad-shipping', 'KHT-BAD-SHIPPING', 'bad-shipping', 'customer', 1000, 70, 'Cairo',
      0, 1070, 'cod', 'admin')`),
  /INVALID_SHIPPING_RATE/,
)

database.exec(`INSERT INTO abandoned_carts
  (id, subtotal, items_count, state, created_at, last_activity)
  VALUES ('stale-cart', 1790, 2, 'active', datetime('now', '-1 hour'), datetime('now', '-35 minutes'));
  INSERT INTO abandoned_cart_items
  (id, cart_id, product_id, variant_id, product_name, variant, image, quantity, unit_price, total)
  VALUES ('cart-line', 'stale-cart', 'kht-001', 'kht-001-m', 'The Line Tee', 'Black / M',
    '/images/tee.png', 2, 895, 1790);`)
assert.equal(
  database.prepare("SELECT COUNT(*) AS count FROM abandoned_carts WHERE state = 'active' AND datetime(last_activity) <= datetime('now', '-30 minutes')").get().count,
  1,
)

console.log('Commerce migration and inventory triggers passed.')