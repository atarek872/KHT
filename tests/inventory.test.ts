import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { lowStockThreshold, updateInventory } from '../server/services/inventory.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

function database(changes: number) {
  return {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            run: async () => ({ success: true, meta: { changes } }),
            first: async () => sql.startsWith('SELECT') ? {
              id: 'tee-m', productId: 'tee', productName: 'Line Tee', category: 'tees',
              sku: 'TEE-M', size: 'M', color: 'Black', stock: values[0] === 'tee-m' ? 2 : 0,
              active: 1, updatedAt: '2026-09-04T00:00:00.000Z',
            } : null,
          }
        },
      }
    },
  }
}

test('inventory updates validate stock and reject stale writes', async () => {
  await assert.rejects(() => updateInventory(database(1) as never, 'tee-m', -1, 3), /non-negative/)
  await assert.rejects(() => updateInventory(database(0) as never, 'tee-m', 2, 3), /INVENTORY_CONFLICT/)
  const updated = await updateInventory(database(1) as never, 'tee-m', 2, 3)
  assert.equal(updated.stock, 2)
  assert.equal(updated.lowStock, true)
  assert.equal(lowStockThreshold, 5)
})

test('inventory API filters on the server and requires expected stock for updates', () => {
  const service = read('../server/services/inventory.ts')
  const list = read('../server/api/admin/inventory/index.get.ts')
  const update = read('../server/api/admin/inventory/[id].patch.ts')
  assert.match(service, /p\.name_en LIKE \? OR v\.sku LIKE \? OR v\.size LIKE \? OR v\.color LIKE \?/)
  assert.match(service, /p\.category = \?/)
  assert.match(service, /v\.stock <= \?/)
  assert.match(update, /expectedStock/)
  assert.match(update, /statusCode: message === 'INVENTORY_CONFLICT' \? 409/)
  assert.match(list, /requireAdmin\(event\)/)
})

test('inventory page exposes exact variants and authoritative save behavior', () => {
  const page = read('../app/pages/admin/inventory/index.vue')
  for (const label of ['Product', 'Variant', 'SKU', 'Category', 'Available', 'Status']) assert.match(page, new RegExp(`>${label}<`))
  assert.match(page, /Low stock only/)
  assert.match(page, /item\.color \}\} \/ \{\{ item\.size/)
  assert.match(page, /body: \{ stock, expectedStock: item\.stock \}/)
  assert.ok(page.indexOf('await $fetch') < page.indexOf('await refresh()'))
  assert.match(page, /admin-inventory-desktop/)
  assert.match(page, /admin-inventory-mobile/)
})

test('D1 inventory is shared by storefront, cart, checkout, and manual orders', () => {
  const catalog = read('../server/services/catalog.ts')
  const cart = read('../app/composables/useStore.ts')
  const checkout = read('../server/api/checkout.post.ts')
  const manual = read('../server/services/createOrder.ts')
  assert.match(catalog, /inventory_variants/)
  assert.match(cart, /size\)\?\.stock/)
  assert.match(checkout, /await getCatalog\(getDatabase\(event\)\)/)
  assert.match(manual, /FROM inventory_variants WHERE active = 1/)
  assert.match(manual, /assertAvailableStock\(quantity, variant\.stock\)/)
})

test('low stock uses explicit text and mobile inventory cards', () => {
  const page = read('../app/pages/admin/inventory/index.vue')
  const css = read('../app/assets/css/admin.css')
  assert.match(page, /item\.lowStock \? 'Low stock' : 'In stock'/)
  assert.match(css, /@media \(max-width: 1023px\)[\s\S]*\.admin-inventory-desktop\s*\{\s*display:\s*none/)
  assert.match(css, /@media \(max-width: 1023px\)[\s\S]*\.admin-inventory-mobile\s*\{\s*display:\s*grid/)
})

test('product metadata edits cannot overwrite existing variant stock', () => {
  const service = read('../server/services/adminProducts.ts')
  const form = read('../app/components/admin/products/ProductForm.vue')
  const conflictClause = service.slice(service.indexOf('ON CONFLICT(id) DO UPDATE SET product_name'))
  assert.doesNotMatch(conflictClause.split('`).bind')[0]!, /stock=excluded\.stock/)
  assert.match(form, /:disabled="!!variant\.id"/)
  assert.match(form, /to="\/admin\/inventory"/)
})