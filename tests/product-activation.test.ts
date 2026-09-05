import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { activateProduct, archiveProduct, getProduct } from '../server/services/adminProducts.ts'
import { createTestD1 } from './helpers/sqliteD1.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const migrations = [
  '0001_commerce.sql',
  '0002_products.sql',
  '0003_categories.sql',
  '0004_discounts.sql',
  '0005_abandoned_carts.sql',
  '0006_commerce_safety.sql',
  '0007_production_commerce.sql',
  '0008_product_gallery_sale_pricing.sql',
].map((name) => new URL(`../server/db/migrations/${name}`, import.meta.url))

function setup() {
  const testDatabase = createTestD1()
  for (const migration of migrations) {
    testDatabase.sqlite.exec(readFileSync(migration, 'utf8'))
  }
  return testDatabase
}

test('closed product confirmation dialog stays hidden', () => {
  const css = read('../app/assets/css/admin.css')

  assert.match(css, /\.kht-admin \.admin-modal:not\(\[open\]\)\s*\{\s*display:\s*none/)
  assert.match(
    css,
    /\.kht-admin \.admin-modal\[open\]\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column/,
  )
  const baseRule = css.match(/\.kht-admin \.admin-modal\s*\{([\s\S]*?)\}/)?.[1] || ''
  assert.doesNotMatch(baseRule, /display:\s*flex/)
})

test('deactivation is reversible and preserves variant choices and stock', async () => {
  const { database, close } = setup()
  try {
    const before = await getProduct(database, 'kht-001')
    assert.ok(before)

    await archiveProduct(database, 'kht-001')
    const inactive = await getProduct(database, 'kht-001')

    assert.equal(inactive?.active, false)
    assert.deepEqual(
      inactive?.variants.map(({ id, active, stock }) => ({ id, active, stock })),
      before.variants.map(({ id, active, stock }) => ({ id, active, stock })),
    )

    const active = await activateProduct(database, 'kht-001')
    assert.equal(active.active, true)
    assert.deepEqual(
      active.variants.map(({ id, active: enabled, stock }) => ({ id, active: enabled, stock })),
      before.variants.map(({ id, active: enabled, stock }) => ({ id, active: enabled, stock })),
    )
  } finally {
    close()
  }
})

test('legacy products without an active variant cannot be reactivated', async () => {
  const { database, sqlite, close } = setup()
  try {
    sqlite.exec(`
      UPDATE products SET active = 0 WHERE id = 'kht-001';
      UPDATE inventory_variants SET active = 0 WHERE product_id = 'kht-001';
    `)

    await assert.rejects(
      () => activateProduct(database, 'kht-001'),
      /PRODUCT_REACTIVATION_REQUIRES_ACTIVE_VARIANT/,
    )
    assert.equal((await getProduct(database, 'kht-001'))?.active, false)
  } finally {
    close()
  }
})

test('inactive products expose a protected Reactivate action', () => {
  const page = read('../app/pages/admin/products/index.vue')
  const route = read('../server/api/admin/products/[id]/activate.post.ts')

  assert.match(page, /Reactivate/)
  assert.match(page, /v-if="!product\.active"/)
  assert.match(route, /requireAdmin\(event\)/)
  assert.match(route, /activateProduct/)
})
