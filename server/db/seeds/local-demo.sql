PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO customers
  (id, name, phone, phone_normalized, email, address, governorate, city, created_at)
VALUES
  ('local-customer-001', 'Mariam Hassan', '01010000001', '201010000001', 'mariam@example.test', '12 Abbas El Akkad Street', 'Cairo', 'Nasr City', datetime('now', '-28 days')),
  ('local-customer-002', 'Omar Adel', '01010000002', '201010000002', 'omar@example.test', '8 Gameat El Dowal Street', 'Giza', 'Mohandessin', datetime('now', '-18 days')),
  ('local-customer-003', 'Nour Ahmed', '01010000003', '201010000003', 'nour@example.test', '25 Fouad Street', 'Alexandria', 'Raml Station', datetime('now', '-10 days')),
  ('local-customer-004', 'Youssef Samir', '01010000004', '201010000004', NULL, '44 Makram Ebeid Street', 'Cairo', 'Nasr City', datetime('now', '-5 days')),
  ('local-customer-005', 'Laila Mostafa', '01010000005', '201010000005', 'laila@example.test', '16 El Hegaz Street', 'Giza', 'Dokki', datetime('now', '-2 days'));

INSERT OR IGNORE INTO discounts
  (id, code, type, value, minimum_order, maximum_discount, usage_limit, current_usage,
   valid_from, valid_until, active, updated_at)
VALUES
  ('local-discount-welcome', 'WELCOME10', 'percentage', 10, 500, 300, 100, 0,
   datetime('now', '-30 days'), datetime('now', '+180 days'), 1, datetime('now', '-30 days')),
  ('local-discount-flat', 'FLAT150', 'fixed', 150, 1000, NULL, 50, 0,
   datetime('now', '-14 days'), datetime('now', '+90 days'), 1, datetime('now', '-14 days')),
  ('local-discount-expired', 'EXPIRED20', 'percentage', 20, NULL, 500, 20, 7,
   datetime('now', '-90 days'), datetime('now', '-1 day'), 1, datetime('now', '-1 day')),
  ('local-discount-paused', 'PAUSED15', 'percentage', 15, NULL, 250, NULL, 0,
   NULL, NULL, 0, datetime('now', '-2 days'));

INSERT OR IGNORE INTO orders
  (id, number, public_reference, idempotency_key, customer_id, subtotal, shipping, shipping_governorate,
   discount, total, payment_method, fulfillment_status, source, notes, discount_id,
   discount_code, created_at)
VALUES
  ('local-order-1001', 'KHT-LOCAL-1001', 'KHT-DEMO-1001', 'local-seed-1001', 'local-customer-001', 1780, 60, 'Cairo',
   178, 1662, 'cod', 'delivered', 'website', 'Delivered demo order.',
   'local-discount-welcome', 'WELCOME10', datetime('now', '-21 days')),
  ('local-order-1002', 'KHT-LOCAL-1002', 'KHT-DEMO-1002', 'local-seed-1002', 'local-customer-002', 2390, 70, 'Giza',
   150, 2310, 'cod', 'shipped', 'instagram', 'Shipped demo order.',
   'local-discount-flat', 'FLAT150', datetime('now', '-12 days')),
  ('local-order-1003', 'KHT-LOCAL-1003', 'KHT-DEMO-1003', 'local-seed-1003', 'local-customer-001', 1290, 90, 'Alexandria',
   0, 1380, 'cod', 'processing', 'whatsapp', 'Processing demo order.',
   NULL, NULL, datetime('now', '-6 days')),
  ('local-order-1004', 'KHT-LOCAL-1004', 'KHT-DEMO-1004', 'local-seed-1004', 'local-customer-003', 2180, 60, 'Cairo',
   0, 2240, 'cod', 'confirmed', 'admin', 'Confirmed manual order.',
   NULL, NULL, datetime('now', '-3 days')),
  ('local-order-1005', 'KHT-LOCAL-1005', 'KHT-DEMO-1005', 'local-seed-1005', 'local-customer-004', 2390, 90, 'Alexandria',
   0, 2480, 'cod', 'pending', 'facebook', 'New order awaiting confirmation.',
   NULL, NULL, datetime('now', '-18 hours')),
  ('local-order-1006', 'KHT-LOCAL-1006', 'KHT-DEMO-1006', 'local-seed-1006', 'local-customer-005', 890, 70, 'Giza',
   0, 960, 'cod', 'cancelled', 'phone', 'Cancelled test order.',
   NULL, NULL, datetime('now', '-2 hours')),
  ('local-order-1007', 'KHT-LOCAL-1007', 'KHT-DEMO-1007', 'local-seed-1007', 'local-customer-002', 1290, 70, 'Giza',
   0, 1360, 'cod', 'shipped', 'website', 'Returned order awaiting stock inspection.',
   NULL, NULL, datetime('now', '-1 day'));

UPDATE orders SET fulfillment_status = 'returned' WHERE id = 'local-order-1007';

INSERT OR IGNORE INTO order_items
  (id, order_id, variant_id, product_name, variant, sku, quantity, unit_price, total)
VALUES
  ('local-line-1001-1', 'local-order-1001', 'kht-001-m', 'The Line Tee', 'Black / M', 'KHT-001-M', 2, 890, 1780),
  ('local-line-1002-1', 'local-order-1002', 'kht-002-l', 'The Line Tracksuit', 'Black / L', 'KHT-002-L', 1, 2390, 2390),
  ('local-line-1003-1', 'local-order-1003', 'kht-003-m', 'The Line Trouser', 'Black / M', 'KHT-003-M', 1, 1290, 1290),
  ('local-line-1004-1', 'local-order-1004', 'kht-001-s', 'The Line Tee', 'Black / S', 'KHT-001-S', 1, 890, 890),
  ('local-line-1004-2', 'local-order-1004', 'kht-003-s', 'The Line Trouser', 'Black / S', 'KHT-003-S', 1, 1290, 1290),
  ('local-line-1005-1', 'local-order-1005', 'kht-002-m', 'The Line Tracksuit', 'Black / M', 'KHT-002-M', 1, 2390, 2390),
  ('local-line-1006-1', 'local-order-1006', 'kht-001-xl', 'The Line Tee', 'Black / XL', 'KHT-001-XL', 1, 890, 890),
  ('local-line-1007-1', 'local-order-1007', 'kht-003-xl', 'The Line Trouser', 'Black / XL', 'KHT-003-XL', 1, 1290, 1290);

UPDATE inventory_variants
SET stock = stock + (
  SELECT SUM(oi.quantity) FROM order_items oi
  WHERE oi.order_id = 'local-order-1006' AND oi.variant_id = inventory_variants.id
)
WHERE EXISTS (
  SELECT 1 FROM orders
  WHERE id = 'local-order-1006' AND inventory_restored_at IS NULL
)
AND EXISTS (
  SELECT 1 FROM order_items oi
  WHERE oi.order_id = 'local-order-1006' AND oi.variant_id = inventory_variants.id
);
UPDATE orders SET inventory_restored_at = datetime('now')
WHERE id = 'local-order-1006' AND inventory_restored_at IS NULL;

UPDATE orders SET payment_status = 'paid' WHERE id IN ('local-order-1001', 'local-order-1002');
UPDATE orders SET payment_status = 'failed' WHERE id = 'local-order-1006';

INSERT OR IGNORE INTO order_events
  (id, order_id, event_type, from_value, to_value, note, actor_email, created_at)
VALUES
  ('local-event-order-1001', 'local-order-1001', 'fulfillment_status', 'shipped', 'delivered', 'Courier confirmed delivery.', 'admin@kht.local', datetime('now', '-20 days')),
  ('local-event-order-1002', 'local-order-1002', 'fulfillment_status', 'processing', 'shipped', 'Handed to courier.', 'admin@kht.local', datetime('now', '-11 days')),
  ('local-event-order-1003', 'local-order-1003', 'fulfillment_status', 'confirmed', 'processing', 'Preparing order.', 'admin@kht.local', datetime('now', '-5 days')),
  ('local-event-order-1004', 'local-order-1004', 'fulfillment_status', 'pending', 'confirmed', 'Customer confirmed by phone.', 'admin@kht.local', datetime('now', '-2 days')),
  ('local-event-order-1005', 'local-order-1005', 'order_created', NULL, 'pending', 'Seeded order awaiting action.', 'system', datetime('now', '-18 hours')),
  ('local-event-order-1006', 'local-order-1006', 'fulfillment_status', 'pending', 'cancelled', 'Customer cancelled before shipping.', 'admin@kht.local', datetime('now', '-2 hours')),
  ('local-event-order-1007', 'local-order-1007', 'fulfillment_status', 'shipped', 'returned', 'Courier returned the parcel.', 'admin@kht.local', datetime('now', '-20 hours'));

INSERT OR IGNORE INTO abandoned_carts
  (id, customer_name, phone, email, subtotal, items_count, state, recovery_state,
   contact_captured_at, recovered_at, created_at, last_activity)
VALUES
  ('local-cart-contacted', 'Salma Khaled', '01010000006', 'salma@example.test', 1780, 2, 'active', 'contacted',
   datetime('now', '-2 hours'), NULL, datetime('now', '-3 hours'), datetime('now', '-95 minutes')),
  ('local-cart-anonymous', NULL, NULL, NULL, 2390, 1, 'active', 'active',
   NULL, NULL, datetime('now', '-2 hours'), datetime('now', '-45 minutes')),
  ('local-cart-recovered', 'Karim Tarek', '01010000007', 'karim@example.test', 1290, 1, 'converted', 'recovered',
   datetime('now', '-5 days'), datetime('now', '-4 days'), datetime('now', '-5 days'), datetime('now', '-4 days')),
  ('local-cart-recent', 'Dina Ali', '01010000008', NULL, 890, 1, 'active', 'active',
   datetime('now', '-15 minutes'), NULL, datetime('now', '-20 minutes'), datetime('now', '-10 minutes'));

INSERT OR IGNORE INTO abandoned_cart_items
  (id, cart_id, product_id, variant_id, product_name, variant, image, quantity, unit_price, total)
VALUES
  ('local-cart-line-001', 'local-cart-contacted', 'kht-001', 'kht-001-l', 'The Line Tee', 'Black / L', '/images/tee.png', 2, 890, 1780),
  ('local-cart-line-002', 'local-cart-anonymous', 'kht-002', 'kht-002-s', 'The Line Tracksuit', 'Black / S', '/images/tracksuit.png', 1, 2390, 2390),
  ('local-cart-line-003', 'local-cart-recovered', 'kht-003', 'kht-003-l', 'The Line Trouser', 'Black / L', '/images/pants.png', 1, 1290, 1290),
  ('local-cart-line-004', 'local-cart-recent', 'kht-001', 'kht-001-s', 'The Line Tee', 'Black / S', '/images/tee.png', 1, 890, 890);

INSERT OR IGNORE INTO abandoned_cart_events
  (id, cart_id, from_state, to_state, actor_email, note, created_at)
VALUES
  ('local-cart-event-contacted', 'local-cart-contacted', 'active', 'contacted', 'admin@kht.local', 'WhatsApp follow-up sent.', datetime('now', '-90 minutes')),
  ('local-cart-event-recovered-1', 'local-cart-recovered', 'active', 'contacted', 'admin@kht.local', 'Customer replied.', datetime('now', '-4 days', '-1 hour')),
  ('local-cart-event-recovered-2', 'local-cart-recovered', 'contacted', 'recovered', 'admin@kht.local', 'Customer placed a new order.', datetime('now', '-4 days'));

PRAGMA optimize;
