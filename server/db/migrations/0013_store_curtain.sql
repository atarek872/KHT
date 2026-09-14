CREATE TABLE IF NOT EXISTS store_curtain_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  mode TEXT NOT NULL DEFAULT 'coming_soon' CHECK (mode IN ('coming_soon', 'under_construction', 'custom')),
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  message_en TEXT NOT NULL,
  message_ar TEXT NOT NULL,
  image_url TEXT,
  countdown_enabled INTEGER NOT NULL DEFAULT 0 CHECK (countdown_enabled IN (0, 1)),
  launch_at TEXT,
  auto_disable_at_launch INTEGER NOT NULL DEFAULT 1 CHECK (auto_disable_at_launch IN (0, 1)),
  cta_enabled INTEGER NOT NULL DEFAULT 0 CHECK (cta_enabled IN (0, 1)),
  cta_label_en TEXT NOT NULL,
  cta_label_ar TEXT NOT NULL,
  cta_url TEXT NOT NULL DEFAULT '/',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL DEFAULT 'system'
);

INSERT OR IGNORE INTO store_curtain_settings (
  id, enabled, mode, title_en, title_ar, message_en, message_ar,
  image_url, countdown_enabled, launch_at, auto_disable_at_launch,
  cta_enabled, cta_label_en, cta_label_ar, cta_url
) VALUES (
  1, 0, 'coming_soon', 'COMING SOON.', 'قريباً.',
  'The next KHT chapter is almost here.', 'الفصل الجديد من KHT قريب.',
  NULL, 0, NULL, 1, 0, 'Follow KHT', 'تابع KHT', '/'
);
