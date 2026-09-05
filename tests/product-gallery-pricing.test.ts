import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { createTestD1 } from './helpers/sqliteD1.ts'

const migrationNames = [
  '0001_commerce.sql',
  '0002_products.sql',
  '0003_categories.sql',
  '0004_discounts.sql',
  '0005_abandoned_carts.sql',
  '0006_commerce_safety.sql',
  '0007_production_commerce.sql',
  '0008_product_gallery_sale_pricing.sql',
]

const migrationUrls = migrationNames.map(
  (name) => new URL(`../server/db/migrations/${name}`, import.meta.url),
)

function applyMigrations(sqlite: ReturnType<typeof createTestD1>['sqlite']) {
  for (const migration of migrationUrls) sqlite.exec(readFileSync(migration, 'utf8'))
}

test('gallery migration backfills every existing product image in position zero', () => {
  assert.equal(existsSync(migrationUrls.at(-1)!), true, 'migration 0008 should exist')
  const { sqlite, close } = createTestD1()
  try {
    applyMigrations(sqlite)
    const rows = sqlite
      .prepare(`SELECT product_id AS productId, url, sort_order AS sortOrder
        FROM product_images ORDER BY product_id, sort_order`)
      .all()
      .map((row) => ({ ...row }))

    assert.deepEqual(rows, [
      { productId: 'kht-001', url: '/images/tee.png', sortOrder: 0 },
      { productId: 'kht-002', url: '/images/tracksuit.png', sortOrder: 0 },
      { productId: 'kht-003', url: '/images/pants.png', sortOrder: 0 },
    ])
  } finally {
    close()
  }
})

test('gallery schema rejects invalid compare prices and duplicate image positions or URLs', () => {
  const { sqlite, close } = createTestD1()
  try {
    applyMigrations(sqlite)

    sqlite.exec(`UPDATE products SET compare_at_price = 1000 WHERE id = 'kht-001'`)
    assert.equal(
      (
        sqlite
          .prepare(`SELECT compare_at_price AS compareAtPrice FROM products WHERE id = 'kht-001'`)
          .get() as { compareAtPrice: number }
      ).compareAtPrice,
      1000,
    )
    assert.throws(
      () => sqlite.exec(`UPDATE products SET compare_at_price = price WHERE id = 'kht-001'`),
      /CHECK constraint failed/,
    )
    assert.throws(
      () => sqlite.exec(`UPDATE products SET compare_at_price = 1000.5 WHERE id = 'kht-001'`),
      /CHECK constraint failed/,
    )
    assert.throws(
      () =>
        sqlite.exec(`INSERT INTO product_images (id, product_id, url, sort_order)
          VALUES ('duplicate-url', 'kht-001', '/images/tee.png', 1)`),
      /UNIQUE constraint failed/,
    )
    assert.throws(
      () =>
        sqlite.exec(`INSERT INTO product_images (id, product_id, url, sort_order)
          VALUES ('duplicate-position', 'kht-001', '/images/alternate.webp', 0)`),
      /UNIQUE constraint failed/,
    )
  } finally {
    close()
  }
})
