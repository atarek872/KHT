CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  image TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO categories (id, slug, name_en, name_ar, image, sort_order) VALUES
  ('category-tees', 'tees', 'T-shirts', 'تيشرتات', '/images/tee.png', 10),
  ('category-sets', 'sets', 'Tracksuits', 'سوت', '/images/tracksuit.png', 20),
  ('category-pants', 'pants', 'Trousers', 'بناطيل', '/images/pants.png', 30);

CREATE INDEX categories_sort_idx ON categories(active, sort_order, name_en);