CREATE TABLE products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  image TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  detail_en TEXT NOT NULL,
  detail_ar TEXT NOT NULL,
  fit_en TEXT NOT NULL,
  fit_ar TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO products
  (id, slug, code, category, price, image, name_en, name_ar, description_en, description_ar,
   detail_en, detail_ar, fit_en, fit_ar)
VALUES
  ('kht-001', 'line-oversized-tee', 'KHT—001', 'tees', 890, '/images/tee.png',
   'The Line Tee', 'تيشرت ذا لاين',
   'An oversized silhouette. One uninterrupted white line. The starting point of the collection.',
   'قَصّة واسعة وخط أبيض متصل. نقطة البداية للمجموعة.',
   'Black body with a single contrasting chest line. Concept garment; final fabric composition and care instructions will accompany the production collection.',
   'تيشرت أسود بخط أبيض على الصدر. قطعة تصورية؛ تفاصيل الخامة والعناية النهائية تُضاف مع مجموعة الإنتاج.',
   'Oversized fit. Dropped shoulder. Choose your usual size for a relaxed silhouette.',
   'قَصّة واسعة وكتف ساقط. اختار مقاسك المعتاد لإطلالة مريحة.'),
  ('kht-002', 'line-tracksuit', 'KHT—002', 'sets', 2390, '/images/tracksuit.png',
   'The Line Tracksuit', 'سوت ذا لاين',
   'Two pieces. One direction. A relaxed jacket and matching trousers, connected by the line.',
   'قطعتان في اتجاه واحد. جاكيت مريح وبنطلون متناسق يجمعهما الخط.',
   'Includes a zip jacket and matching trousers in one size. Concept garment; final fabric composition and care instructions will accompany the production collection.',
   'يشمل جاكيت بسوستة وبنطلون بنفس المقاس. قطعة تصورية؛ تفاصيل الخامة والعناية النهائية تُضاف مع مجموعة الإنتاج.',
   'Relaxed fit throughout. Jacket and trousers are sold together in the selected size.',
   'قَصّة مريحة. الجاكيت والبنطلون يُباعان معًا بالمقاس المختار.'),
  ('kht-003', 'line-wide-leg-trouser', 'KHT—003', 'pants', 1290, '/images/pants.png',
   'The Line Trouser', 'بنطلون ذا لاين',
   'A wide-leg cut with a clean vertical line. Made to anchor the complete look.',
   'قَصّة واسعة وخط رأسي واضح. القطعة التي تكمل الإطلالة.',
   'Black trousers with a contrasting side line. Concept garment; final fabric composition and care instructions will accompany the production collection.',
   'بنطلون أسود بخط جانبي أبيض. قطعة تصورية؛ تفاصيل الخامة والعناية النهائية تُضاف مع مجموعة الإنتاج.',
   'Wide leg. Relaxed waist. Refer to the size guide before choosing.',
   'رِجل واسعة ووسط مريح. راجع دليل المقاسات قبل الاختيار.');

ALTER TABLE inventory_variants ADD COLUMN updated_at TEXT NOT NULL DEFAULT '2026-09-04T00:00:00.000Z';
CREATE INDEX products_updated_at_idx ON products(updated_at DESC);
CREATE INDEX inventory_variants_product_idx ON inventory_variants(product_id);