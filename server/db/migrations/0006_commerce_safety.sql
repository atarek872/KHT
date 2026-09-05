ALTER TABLE orders ADD COLUMN shipping_governorate TEXT;

CREATE TRIGGER validate_order_amounts_before_insert
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'DISCOUNT_EXCEEDS_SUBTOTAL')
  WHERE NEW.discount > NEW.subtotal;

  SELECT RAISE(ABORT, 'INVALID_ORDER_TOTAL')
  WHERE NEW.total != NEW.subtotal - NEW.discount + NEW.shipping;

  SELECT RAISE(ABORT, 'INVALID_COD_PAYMENT_STATUS')
  WHERE NEW.payment_method = 'cod' AND NEW.payment_status != 'pending';

  SELECT RAISE(ABORT, 'INVALID_PAYMENT_STATUS')
  WHERE NEW.payment_status NOT IN ('pending', 'paid', 'failed', 'refunded');

  SELECT RAISE(ABORT, 'INVALID_FULFILLMENT_STATUS')
  WHERE NEW.fulfillment_status NOT IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');

  SELECT RAISE(ABORT, 'INVALID_DISCOUNT_REFERENCE')
  WHERE NEW.discount_id IS NULL AND (NEW.discount != 0 OR NEW.discount_code IS NOT NULL);

  SELECT RAISE(ABORT, 'INVALID_SHIPPING_RATE')
  WHERE NEW.shipping_governorate IS NULL OR NOT EXISTS (
    SELECT 1 FROM shipping_zones s
    WHERE s.governorate = NEW.shipping_governorate
      AND s.enabled = 1
      AND s.rate = NEW.shipping
  );
END;

CREATE TRIGGER validate_discount_amount_before_order
BEFORE INSERT ON orders
FOR EACH ROW WHEN NEW.discount_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'INVALID_DISCOUNT_AMOUNT') WHERE NEW.discount != (
    SELECT MIN(
      NEW.subtotal,
      COALESCE(
        MIN(
          CAST((NEW.subtotal * percentage.value) / 100 AS INTEGER),
          COALESCE(percentage.maximum_discount, NEW.subtotal)
        ),
        fixed.value
      )
    )
    FROM discounts d
    LEFT JOIN discounts percentage
      ON percentage.id = d.id AND percentage.type = 'percentage'
    LEFT JOIN discounts fixed
      ON fixed.id = d.id AND fixed.type = 'fixed'
    WHERE d.id = NEW.discount_id
  );
END;

CREATE TRIGGER validate_order_statuses_before_update
BEFORE UPDATE OF payment_status, fulfillment_status ON orders
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'INVALID_PAYMENT_STATUS')
  WHERE NEW.payment_status NOT IN ('pending', 'paid', 'failed', 'refunded');

  SELECT RAISE(ABORT, 'INVALID_FULFILLMENT_STATUS')
  WHERE NEW.fulfillment_status NOT IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');
END;

CREATE TRIGGER validate_order_item_amount_before_insert
BEFORE INSERT ON order_items
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'STALE_VARIANT_PRICE')
  WHERE NEW.unit_price != (
    SELECT unit_price FROM inventory_variants WHERE id = NEW.variant_id
  );

  SELECT RAISE(ABORT, 'INVALID_LINE_TOTAL')
  WHERE NEW.total != NEW.quantity * NEW.unit_price;
END;
