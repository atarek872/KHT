-- A full set consumes one hoodie and one pair of pants in the selected size.
CREATE TABLE inventory_bundle_components (
  bundle_variant_id TEXT NOT NULL REFERENCES inventory_variants(id),
  component_variant_id TEXT NOT NULL REFERENCES inventory_variants(id),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
  PRIMARY KEY(bundle_variant_id, component_variant_id),
  CHECK(bundle_variant_id <> component_variant_id)
);
CREATE INDEX inventory_bundle_component_idx ON inventory_bundle_components(component_variant_id);

INSERT INTO inventory_bundle_components(bundle_variant_id, component_variant_id, quantity)
SELECT b.id, c.id, 1 FROM inventory_variants b
JOIN products bp ON bp.id=b.product_id AND bp.slug='line-01-full-set-black'
JOIN products cp ON cp.slug IN ('line-01-oversized-hoodie-black','line-01-wide-leg-pants-black')
JOIN inventory_variants c ON c.product_id=cp.id AND c.size=b.size AND c.color=b.color;

-- Each production size began with 25 hoodies and 25 pants. The existing set
-- counter has already reserved set sales, while component counters have not.
UPDATE inventory_variants SET stock=stock-COALESCE((
  SELECT SUM((25-b.stock)*bc.quantity) FROM inventory_bundle_components bc
  JOIN inventory_variants b ON b.id=bc.bundle_variant_id
  WHERE bc.component_variant_id=inventory_variants.id
),0)
WHERE id IN (SELECT component_variant_id FROM inventory_bundle_components);

UPDATE inventory_variants SET stock=(
  SELECT MIN(CASE WHEN c.active=1 THEN CAST(c.stock / bc.quantity AS INTEGER) ELSE 0 END)
  FROM inventory_bundle_components bc
  JOIN inventory_variants c ON c.id=bc.component_variant_id
  WHERE bc.bundle_variant_id=inventory_variants.id
)
WHERE id IN (SELECT bundle_variant_id FROM inventory_bundle_components);

CREATE TABLE order_item_components (
  order_item_id TEXT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES inventory_variants(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  PRIMARY KEY(order_item_id, variant_id)
);
CREATE INDEX order_item_components_variant_idx ON order_item_components(variant_id);

INSERT INTO order_item_components(order_item_id, variant_id, quantity)
SELECT oi.id, bc.component_variant_id, oi.quantity*bc.quantity
FROM order_items oi JOIN inventory_bundle_components bc ON bc.bundle_variant_id=oi.variant_id;

DROP TRIGGER reserve_inventory_before_order_item;
CREATE TRIGGER reserve_inventory_before_order_item BEFORE INSERT ON order_items BEGIN
  SELECT RAISE(ABORT,'VARIANT_UNAVAILABLE') WHERE NOT EXISTS (
    SELECT 1 FROM inventory_variants WHERE id=NEW.variant_id AND active=1
  );
  SELECT RAISE(ABORT,'INSUFFICIENT_STOCK') WHERE (
    SELECT stock FROM inventory_variants WHERE id=NEW.variant_id
  ) < NEW.quantity;
  SELECT RAISE(ABORT,'COMPONENT_UNAVAILABLE') WHERE EXISTS (
    SELECT 1 FROM inventory_bundle_components bc
    JOIN inventory_variants c ON c.id=bc.component_variant_id
    WHERE bc.bundle_variant_id=NEW.variant_id
      AND (c.active=0 OR c.stock < NEW.quantity*bc.quantity)
  );
END;

DROP TRIGGER decrement_inventory_after_order_item;
CREATE TRIGGER decrement_inventory_after_order_item AFTER INSERT ON order_items BEGIN
  UPDATE inventory_variants SET stock=stock-NEW.quantity
  WHERE id=NEW.variant_id AND NOT EXISTS (
    SELECT 1 FROM inventory_bundle_components WHERE bundle_variant_id=NEW.variant_id
  );
  INSERT INTO order_item_components(order_item_id,variant_id,quantity)
  SELECT NEW.id, component_variant_id, NEW.quantity*quantity
  FROM inventory_bundle_components WHERE bundle_variant_id=NEW.variant_id;
  UPDATE inventory_variants SET stock=stock-NEW.quantity*(
    SELECT bc.quantity FROM inventory_bundle_components bc
    WHERE bc.bundle_variant_id=NEW.variant_id AND bc.component_variant_id=inventory_variants.id
  ) WHERE id IN (
    SELECT component_variant_id FROM inventory_bundle_components
    WHERE bundle_variant_id=NEW.variant_id
  );
END;

CREATE TRIGGER sync_bundle_stock_after_component_update
AFTER UPDATE OF stock,active ON inventory_variants
WHEN EXISTS (SELECT 1 FROM inventory_bundle_components WHERE component_variant_id=NEW.id)
BEGIN
  UPDATE inventory_variants SET stock=(
    SELECT MIN(CASE WHEN c.active=1 THEN CAST(c.stock / bc.quantity AS INTEGER) ELSE 0 END)
    FROM inventory_bundle_components bc
    JOIN inventory_variants c ON c.id=bc.component_variant_id
    WHERE bc.bundle_variant_id=inventory_variants.id
  ) WHERE id IN (
    SELECT bundle_variant_id FROM inventory_bundle_components WHERE component_variant_id=NEW.id
  );
END;

CREATE TRIGGER protect_mapped_variant_identity
BEFORE UPDATE OF product_id,size,color ON inventory_variants
WHEN (NEW.product_id<>OLD.product_id OR NEW.size<>OLD.size OR NEW.color<>OLD.color)
  AND EXISTS (SELECT 1 FROM inventory_bundle_components
    WHERE bundle_variant_id=OLD.id OR component_variant_id=OLD.id)
BEGIN
  SELECT RAISE(ABORT,'MAPPED_VARIANT_IDENTITY_FIXED');
END;

CREATE TABLE order_component_exchanges (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id TEXT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  from_variant_id TEXT NOT NULL REFERENCES inventory_variants(id),
  to_variant_id TEXT NOT NULL REFERENCES inventory_variants(id),
  quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 10),
  returned_received INTEGER NOT NULL CHECK(returned_received IN (0,1)),
  actor_email TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  CHECK(from_variant_id <> to_variant_id)
);
CREATE INDEX order_component_exchanges_order_idx ON order_component_exchanges(order_id,created_at DESC);

CREATE TRIGGER validate_component_exchange BEFORE INSERT ON order_component_exchanges BEGIN
  SELECT RAISE(ABORT,'EXCHANGE_ORDER_UNAVAILABLE') WHERE NOT EXISTS (
    SELECT 1 FROM orders o JOIN order_items oi ON oi.order_id=o.id
    WHERE o.id=NEW.order_id AND oi.id=NEW.order_item_id
      AND o.fulfillment_status NOT IN ('cancelled','returned')
      AND o.inventory_restored_at IS NULL AND o.returned_restocked_at IS NULL
      AND (o.fulfillment_status IN ('pending','confirmed','processing') OR NEW.returned_received=1)
  );
  SELECT RAISE(ABORT,'EXCHANGE_SOURCE_UNAVAILABLE') WHERE NOT EXISTS (
    SELECT 1 FROM order_item_components c
    WHERE c.order_item_id=NEW.order_item_id AND c.variant_id=NEW.from_variant_id
      AND c.quantity>=NEW.quantity
  );
  SELECT RAISE(ABORT,'EXCHANGE_TARGET_UNAVAILABLE') WHERE NOT EXISTS (
    SELECT 1 FROM inventory_variants source JOIN inventory_variants target
      ON target.product_id=source.product_id AND target.color=source.color
    WHERE source.id=NEW.from_variant_id AND target.id=NEW.to_variant_id
      AND target.size<>source.size AND target.active=1 AND target.stock>=NEW.quantity
  );
END;

CREATE TRIGGER apply_component_exchange AFTER INSERT ON order_component_exchanges BEGIN
  UPDATE inventory_variants SET stock=stock-NEW.quantity WHERE id=NEW.to_variant_id;
  UPDATE inventory_variants SET stock=stock+NEW.quantity WHERE id=NEW.from_variant_id;
  UPDATE order_item_components SET quantity=quantity-NEW.quantity
    WHERE order_item_id=NEW.order_item_id AND variant_id=NEW.from_variant_id
      AND quantity>NEW.quantity;
  DELETE FROM order_item_components WHERE order_item_id=NEW.order_item_id
    AND variant_id=NEW.from_variant_id AND quantity=NEW.quantity;
  INSERT INTO order_item_components(order_item_id,variant_id,quantity)
  VALUES(NEW.order_item_id,NEW.to_variant_id,NEW.quantity)
  ON CONFLICT(order_item_id,variant_id) DO UPDATE SET quantity=quantity+excluded.quantity;
  INSERT INTO order_events(id,order_id,event_type,from_value,to_value,note,actor_email,created_at)
  VALUES(NEW.id,NEW.order_id,'component_exchanged',
    (SELECT size FROM inventory_variants WHERE id=NEW.from_variant_id),
    (SELECT size FROM inventory_variants WHERE id=NEW.to_variant_id),
    NEW.note,NEW.actor_email,NEW.created_at);
END;

ALTER TABLE orders ADD COLUMN manual_discount_percent INTEGER
  CHECK(manual_discount_percent IS NULL OR manual_discount_percent BETWEEN 1 AND 100);
DROP TRIGGER validate_order_amounts_before_insert;
CREATE TRIGGER validate_order_amounts_before_insert BEFORE INSERT ON orders BEGIN
  SELECT RAISE(ABORT,'DISCOUNT_EXCEEDS_SUBTOTAL') WHERE NEW.discount>NEW.subtotal;
  SELECT RAISE(ABORT,'INVALID_ORDER_TOTAL')
    WHERE NEW.total!=NEW.subtotal-NEW.discount+NEW.shipping;
  SELECT RAISE(ABORT,'INVALID_COD_PAYMENT_STATUS')
    WHERE NEW.payment_method='cod' AND NEW.payment_status!='pending';
  SELECT RAISE(ABORT,'INVALID_PAYMENT_STATUS')
    WHERE NEW.payment_status NOT IN ('pending','paid','failed','refunded');
  SELECT RAISE(ABORT,'INVALID_FULFILLMENT_STATUS')
    WHERE NEW.fulfillment_status NOT IN ('pending','confirmed','processing','shipped','out-for-delivery','delivered','cancelled','returned');
  SELECT RAISE(ABORT,'INVALID_DISCOUNT_REFERENCE') WHERE
    (NEW.discount_id IS NULL AND NEW.manual_discount_percent IS NULL
      AND (NEW.discount!=0 OR NEW.discount_code IS NOT NULL)) OR
    (NEW.manual_discount_percent IS NOT NULL AND
      (NEW.discount_id IS NOT NULL OR NEW.discount_code IS NOT NULL OR
       NEW.discount!=CAST(NEW.subtotal*NEW.manual_discount_percent/100 AS INTEGER)));
  SELECT RAISE(ABORT,'INVALID_SHIPPING_RATE') WHERE NEW.shipping_governorate IS NULL
    OR NOT EXISTS (SELECT 1 FROM shipping_zones s WHERE s.governorate=NEW.shipping_governorate
      AND s.enabled=1 AND s.rate=NEW.shipping);
END;
