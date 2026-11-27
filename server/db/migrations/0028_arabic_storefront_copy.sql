-- Preserve all published settings while clarifying the Arabic hero button.
UPDATE storefront_content_state SET
  draft_json = json_set(draft_json, '$.pages.home.hero.ctaLabel.ar', 'تسوّق الطقم الكامل'),
  published_json = json_set(published_json, '$.pages.home.hero.ctaLabel.ar', 'تسوّق الطقم الكامل')
WHERE id = 1
  AND json_extract(published_json, '$.pages.home.hero.ctaLabel.ar') = 'تسوّق الـFull Set';

UPDATE products SET name_ar = 'طقم KHT 01 الكامل'
WHERE slug = 'line-01-full-set-black' AND name_ar = 'سيت KHT LINE 01 كامل';
UPDATE products SET name_ar = 'هودي KHT 01 بقصة واسعة'
WHERE slug = 'line-01-oversized-hoodie-black' AND name_ar = 'هودي KHT LINE 01 أوفرسايز';
UPDATE products SET name_ar = 'بنطلون KHT 01 بقصة واسعة'
WHERE slug = 'line-01-wide-leg-pants-black' AND name_ar = 'بنطلون KHT LINE 01 وايد ليج';
