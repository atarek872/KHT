ALTER TABLE orders ADD COLUMN shipping_governorate TEXT;

CREATE TRIGGER validate_order_amounts_before_insert
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NEW.discount > NEW.subtotal
      THEN RAISE(ABORT, 'DISCOUNT_EXCEEDS_SUBTOTAL')
    WHEN NEW.total != NEW.subtotal - NEW.discount + NEW.shipping
      THEN RAISE(ABORT, 'INVALID_ORDER_TOTAL')
    WHEN NEW.payment_method = 'cod' AND NEW.payment_status != 'pending'
      THEN RAISE(ABORT, 'INVALID_COD_PAYMENT_STATUS')
    WHEN NEW.payment_status NOT IN ('pending', 'paid', 'failed', 'refunded')
      THEN RAISE(ABORT, 'INVALID_PAYMENT_STATUS')
    WHEN NEW.fulfillment_status NOT IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')
      THEN RAISE(ABORT, 'INVALID_FULFILLMENT_STATUS')
    WHEN NEW.discount_id IS NULL AND (NEW.discount != 0 OR NEW.discount_code IS NOT NULL)
      THEN RAISE(ABORT, 'INVALID_DISCOUNT_REFERENCE')
    WHEN NEW.shipping_governorate IS NULL OR NOT EXISTS (
      SELECT 1 FROM shipping_zones s
      WHERE s.governorate = NEW.shipping_governorate
        AND s.enabled = 1
        AND s.rate = NEW.shipping
    ) THEN RAISE(ABORT, 'INVALID_SHIPPING_RATE')
  END;
END;

CREATE TRIGGER validate_discount_amount_before_order
BEFORE INSERT ON orders
FOR EACH ROW WHEN NEW.discount_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NEW.discount != (
    SELECT MIN(
      NEW.subtotal,
      CASE
        WHEN d.type = 'percentage' THEN MIN(
          CAST((NEW.subtotal * d.value) / 100 AS INTEGER),
          COALESCE(d.maximum_discount, NEW.subtotal)
        )
        ELSE d.value
      END
    )
    FROM discounts d WHERE d.id = NEW.discount_id
  ) THEN RAISE(ABORT, 'INVALID_DISCOUNT_AMOUNT') END;
END;

CREATE TRIGGER validate_order_statuses_before_update
BEFORE UPDATE OF payment_status, fulfillment_status ON orders
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NEW.payment_status NOT IN ('pending', 'paid', 'failed', 'refunded')
      THEN RAISE(ABORT, 'INVALID_PAYMENT_STATUS')
    WHEN NEW.fulfillment_status NOT IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')
      THEN RAISE(ABORT, 'INVALID_FULFILLMENT_STATUS')
  END;
END;

CREATE TRIGGER validate_order_item_amount_before_insert
BEFORE INSERT ON order_items
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NEW.unit_price != (
      SELECT unit_price FROM inventory_variants WHERE id = NEW.variant_id
    ) THEN RAISE(ABORT, 'STALE_VARIANT_PRICE')
    WHEN NEW.total != NEW.quantity * NEW.unit_price
      THEN RAISE(ABORT, 'INVALID_LINE_TOTAL')
  END;
END;