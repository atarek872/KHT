ALTER TABLE orders ADD COLUMN public_reference TEXT;
ALTER TABLE orders ADD COLUMN inventory_restored_at TEXT;
ALTER TABLE orders ADD COLUMN returned_restocked_at TEXT;

ALTER TABLE customers ADD COLUMN phone_normalized TEXT;
UPDATE customers
SET phone_normalized = replace(replace(replace(replace(replace(phone,
  ' ', ''), '-', ''), '(', ''), ')', ''), '+', '')
WHERE phone_normalized IS NULL;
UPDATE customers
SET phone_normalized = CASE
  WHEN length(phone_normalized) = 11 AND substr(phone_normalized, 1, 2) = '01'
    THEN '20' || substr(phone_normalized, 2)
  WHEN length(phone_normalized) = 14 AND substr(phone_normalized, 1, 4) = '0020'
    THEN substr(phone_normalized, 3)
  ELSE phone_normalized
END;
CREATE UNIQUE INDEX customers_phone_normalized_idx
ON customers(phone_normalized)
WHERE phone_normalized IS NOT NULL;

UPDATE orders
SET public_reference = number || '-' || upper(substr(hex(randomblob(4)), 1, 8))
WHERE public_reference IS NULL;
CREATE UNIQUE INDEX orders_public_reference_idx ON orders(public_reference);

CREATE TRIGGER require_order_public_reference_before_insert
BEFORE INSERT ON orders
FOR EACH ROW WHEN NEW.public_reference IS NULL OR trim(NEW.public_reference) = ''
BEGIN
  SELECT RAISE(ABORT, 'PUBLIC_REFERENCE_REQUIRED');
END;

CREATE TRIGGER require_order_public_reference_before_update
BEFORE UPDATE OF public_reference ON orders
FOR EACH ROW WHEN NEW.public_reference IS NULL OR trim(NEW.public_reference) = ''
BEGIN
  SELECT RAISE(ABORT, 'PUBLIC_REFERENCE_REQUIRED');
END;

CREATE TABLE order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  note TEXT,
  actor_email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX order_events_order_idx
ON order_events(order_id, created_at DESC);

ALTER TABLE abandoned_carts ADD COLUMN recovery_state TEXT NOT NULL DEFAULT 'active'
CHECK (recovery_state IN ('active', 'contacted', 'dismissed', 'converted', 'recovered'));
ALTER TABLE abandoned_carts ADD COLUMN contact_captured_at TEXT;
ALTER TABLE abandoned_carts ADD COLUMN recovered_order_id TEXT REFERENCES orders(id);

UPDATE abandoned_carts
SET recovery_state = CASE state
  WHEN 'converted' THEN 'converted'
  WHEN 'cleared' THEN 'dismissed'
  ELSE 'active'
END;

CREATE TABLE abandoned_cart_events (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES abandoned_carts(id) ON DELETE CASCADE,
  from_state TEXT,
  to_state TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX abandoned_cart_events_cart_idx
ON abandoned_cart_events(cart_id, created_at DESC);

CREATE TABLE request_rate_limits (
  key_hash TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL CHECK (request_count >= 0),
  expires_at TEXT NOT NULL
);
CREATE INDEX request_rate_limits_expiry_idx
ON request_rate_limits(expires_at);

DROP TRIGGER validate_order_statuses_before_update;
CREATE TRIGGER validate_order_statuses_before_update
BEFORE UPDATE OF payment_status, fulfillment_status ON orders
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'INVALID_PAYMENT_STATUS')
  WHERE NEW.payment_status NOT IN ('pending', 'paid', 'failed', 'refunded');

  SELECT RAISE(ABORT, 'INVALID_FULFILLMENT_STATUS')
  WHERE NEW.fulfillment_status NOT IN
    ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned');
END;
