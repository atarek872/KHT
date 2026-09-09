ALTER TABLE orders ADD COLUMN user_id TEXT REFERENCES customer_users(id);
ALTER TABLE orders ADD COLUMN cart_id TEXT REFERENCES abandoned_carts(id);
ALTER TABLE orders ADD COLUMN cart_version INTEGER;
ALTER TABLE orders ADD COLUMN shipping_snapshot TEXT;
ALTER TABLE orders ADD COLUMN tracking_number TEXT;
ALTER TABLE orders ADD COLUMN tracking_carrier TEXT;
CREATE INDEX orders_user_date ON orders(user_id, created_at DESC);
CREATE TABLE order_status_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 status TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX order_history_order ON order_status_history(order_id,id);
CREATE TRIGGER validate_order_cart BEFORE INSERT ON orders
WHEN NEW.cart_id IS NOT NULL BEGIN
 SELECT (CASE WHEN NOT EXISTS (SELECT 1 FROM abandoned_carts c WHERE c.id=NEW.cart_id AND c.user_id IS NEW.user_id AND c.version=NEW.cart_version AND c.state='active' AND c.items_count>0) THEN RAISE(ABORT,'CART_CHANGED') END);
END;
CREATE TRIGGER convert_order_cart AFTER INSERT ON orders
WHEN NEW.cart_id IS NOT NULL BEGIN
 UPDATE abandoned_carts SET state='converted',recovered_at=NEW.created_at,version=version+1 WHERE id=NEW.cart_id;
END;
CREATE TRIGGER snapshot_order_shipping AFTER INSERT ON orders
WHEN NEW.shipping_snapshot IS NULL BEGIN
 UPDATE orders SET shipping_snapshot=(SELECT json_object('name',name,'phone',phone,'email',email,'address',address,'city',city,'governorate',governorate) FROM customers WHERE id=NEW.customer_id) WHERE id=NEW.id;
END;
CREATE TRIGGER initial_order_history AFTER INSERT ON orders BEGIN
 INSERT INTO order_status_history(order_id,status,created_at) VALUES(NEW.id,NEW.fulfillment_status,NEW.created_at);
END;
DROP TRIGGER validate_order_statuses_before_update;
CREATE TRIGGER validate_order_statuses_before_update
BEFORE UPDATE OF payment_status,fulfillment_status ON orders BEGIN
 SELECT (CASE WHEN NEW.payment_status NOT IN ('pending','paid','failed','refunded') THEN RAISE(ABORT,'INVALID_PAYMENT_STATUS')
 WHEN NEW.fulfillment_status NOT IN ('pending','confirmed','processing','shipped','out-for-delivery','delivered','cancelled','returned') THEN RAISE(ABORT,'INVALID_FULFILLMENT_STATUS') END);
 SELECT (CASE WHEN NEW.fulfillment_status!=OLD.fulfillment_status AND NOT (
 (OLD.fulfillment_status='pending' AND NEW.fulfillment_status IN ('confirmed','cancelled')) OR
 (OLD.fulfillment_status='confirmed' AND NEW.fulfillment_status IN ('processing','cancelled')) OR
 (OLD.fulfillment_status='processing' AND NEW.fulfillment_status IN ('shipped','cancelled')) OR
 (OLD.fulfillment_status='shipped' AND NEW.fulfillment_status='out-for-delivery') OR
 (OLD.fulfillment_status='out-for-delivery' AND NEW.fulfillment_status='delivered') OR
 (OLD.fulfillment_status='delivered' AND NEW.fulfillment_status='returned')
 ) THEN RAISE(ABORT,'INVALID_FULFILLMENT_TRANSITION') END);
END;
CREATE TRIGGER changed_order_history AFTER UPDATE OF fulfillment_status ON orders
WHEN NEW.fulfillment_status!=OLD.fulfillment_status BEGIN
 INSERT INTO order_status_history(order_id,status) VALUES(NEW.id,NEW.fulfillment_status);
END;
