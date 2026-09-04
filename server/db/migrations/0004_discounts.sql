CREATE TABLE discounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value INTEGER NOT NULL CHECK (value > 0),
  minimum_order INTEGER CHECK (minimum_order IS NULL OR minimum_order >= 0),
  maximum_discount INTEGER CHECK (maximum_discount IS NULL OR maximum_discount > 0),
  usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
  current_usage INTEGER NOT NULL DEFAULT 0 CHECK (current_usage >= 0),
  valid_from TEXT,
  valid_until TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE orders ADD COLUMN discount_id TEXT REFERENCES discounts(id);
ALTER TABLE orders ADD COLUMN discount_code TEXT;

CREATE TRIGGER validate_discount_before_order
BEFORE INSERT ON orders
FOR EACH ROW WHEN NEW.discount_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM discounts d WHERE d.id = NEW.discount_id
      AND d.code = NEW.discount_code
      AND d.active = 1
      AND (d.valid_from IS NULL OR datetime(d.valid_from) <= datetime('now'))
      AND (d.valid_until IS NULL OR datetime(d.valid_until) >= datetime('now'))
      AND (d.minimum_order IS NULL OR NEW.subtotal >= d.minimum_order)
      AND (d.usage_limit IS NULL OR d.current_usage < d.usage_limit)
  ) THEN RAISE(ABORT, 'DISCOUNT_UNAVAILABLE') END;
END;

CREATE TRIGGER consume_discount_after_order
AFTER INSERT ON orders
FOR EACH ROW WHEN NEW.discount_id IS NOT NULL
BEGIN
  UPDATE discounts SET current_usage = current_usage + 1, updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.discount_id;
END;

CREATE INDEX discounts_code_idx ON discounts(code);