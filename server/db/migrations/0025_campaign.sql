-- Black Friday 2026 ends at midnight Cairo time after November 30.
UPDATE discounts SET valid_until = '2026-11-30T21:59:59Z', updated_at = CURRENT_TIMESTAMP
WHERE code = 'KHTBLACK15' AND type = 'percentage' AND value = 15;

UPDATE storefront_content_state SET
  draft_json = json_set(draft_json,
    '$.brand.contactPhone', '+201553815746',
    '$.brand.contactWhatsApp', '+201553815746',
    '$.brand.instagramUrl', 'https://www.instagram.com/kht.eg/',
    '$.brand.tiktokUrl', 'https://www.tiktok.com/@khteg007',
    '$.brand.promotion', json_object(
      'announcementEnabled', json('true'),
      'announcementMessage', json_object(
        'en', 'BLACK FRIDAY · 15% off orders EGP 1,500+ with KHTBLACK15 · Ends Nov 30',
        'ar', 'بلاك فرايداي · خصم ١٥٪ على طلبات من ١٥٠٠ جنيه بكود KHTBLACK15 · لحد ٣٠ نوفمبر'),
      'announcementCode', 'KHTBLACK15',
      'announcementLink', '/cart',
      'announcementStartDate', '2026-11-27',
      'announcementEndDate', '2026-11-30',
      'freeShippingEnabled', json('false'),
      'freeShippingStartDate', '',
      'freeShippingEndDate', '',
      'freeShippingWeekdays', json('[]')),
    '$.policyHighlights.productInspectionMessage', json_object(
      'en', 'Inspect your order while the courier waits. If it is not right for you, decline delivery and hand it back to the courier.',
      'ar', 'افحص طلبك والمندوب مستني. لو المنتج مش مناسب لك، ارفض الاستلام ورجّعه للمندوب.')),
  published_json = json_set(published_json,
    '$.brand.contactPhone', '+201553815746',
    '$.brand.contactWhatsApp', '+201553815746',
    '$.brand.instagramUrl', 'https://www.instagram.com/kht.eg/',
    '$.brand.tiktokUrl', 'https://www.tiktok.com/@khteg007',
    '$.brand.promotion', json_object(
      'announcementEnabled', json('true'),
      'announcementMessage', json_object(
        'en', 'BLACK FRIDAY · 15% off orders EGP 1,500+ with KHTBLACK15 · Ends Nov 30',
        'ar', 'بلاك فرايداي · خصم ١٥٪ على طلبات من ١٥٠٠ جنيه بكود KHTBLACK15 · لحد ٣٠ نوفمبر'),
      'announcementCode', 'KHTBLACK15',
      'announcementLink', '/cart',
      'announcementStartDate', '2026-11-27',
      'announcementEndDate', '2026-11-30',
      'freeShippingEnabled', json('false'),
      'freeShippingStartDate', '',
      'freeShippingEndDate', '',
      'freeShippingWeekdays', json('[]')),
    '$.policyHighlights.productInspectionMessage', json_object(
      'en', 'Inspect your order while the courier waits. If it is not right for you, decline delivery and hand it back to the courier.',
      'ar', 'افحص طلبك والمندوب مستني. لو المنتج مش مناسب لك، ارفض الاستلام ورجّعه للمندوب.'))
WHERE id = 1;

-- Keep the database guard for configured rates; permit a zero delivery charge
-- only while the published free-delivery switch is enabled. The server also
-- checks the Cairo schedule before it inserts an order.
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
    WHERE NEW.fulfillment_status NOT IN
      ('pending','confirmed','processing','shipped','out-for-delivery','delivered','cancelled','returned');
  SELECT RAISE(ABORT,'INVALID_DISCOUNT_REFERENCE') WHERE
    (NEW.discount_id IS NULL AND NEW.manual_discount_percent IS NULL
      AND (NEW.discount!=0 OR NEW.discount_code IS NOT NULL)) OR
    (NEW.manual_discount_percent IS NOT NULL AND
      (NEW.discount_id IS NOT NULL OR NEW.discount_code IS NOT NULL OR
       NEW.discount!=CAST(NEW.subtotal*NEW.manual_discount_percent/100 AS INTEGER)));
  SELECT RAISE(ABORT,'INVALID_SHIPPING_RATE') WHERE NEW.shipping_governorate IS NULL
    OR NOT EXISTS (SELECT 1 FROM shipping_zones s WHERE s.governorate=NEW.shipping_governorate
      AND s.enabled=1 AND (
        s.rate=NEW.shipping OR (
          NEW.shipping=0 AND EXISTS (
            SELECT 1 FROM storefront_content_state c
            WHERE c.id=1 AND json_extract(c.published_json,'$.brand.promotion.freeShippingEnabled')=1
          )
        )
      ));
END;
