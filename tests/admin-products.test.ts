import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateProduct } from '../server/services/adminProducts.ts'
import type { AdminProductInput } from '../shared/adminProduct.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const product: AdminProductInput = {
  slug: 'line-tee', code: 'KHT-001', category: 'tees', price: 890, image: '/images/tee.png', active: true,
  name: { en: 'Line Tee', ar: 'تيشرت لاين' }, description: { en: 'Description', ar: 'وصف' },
  detail: { en: 'Detail', ar: 'تفاصيل' }, fit: { en: 'Relaxed', ar: 'مريح' },
  variants: [{ sku: 'KHT-001-M', size: 'M', color: 'Black', stock: 3, active: true }],
}

test('product validation preserves existing catalog requirements', () => {
  assert.doesNotThrow(() => validateProduct(product))
  assert.throws(() => validateProduct({ ...product, slug: 'Bad Slug' }), /lowercase URL slug/)
  assert.throws(() => validateProduct({ ...product, category: 'unknown' }), /existing category/)
  assert.throws(() => validateProduct({ ...product, image: 'https://example.com/a.jpg' }), /valid product image/)
  assert.throws(() => validateProduct({ ...product, variants: [] }), /at least one variant/)
})

test('product validation rejects invalid stock and duplicate SKUs', () => {
  assert.throws(() => validateProduct({ ...product, variants: [{ ...product.variants[0]!, stock: -1 }] }), /non-negative/)
  assert.throws(() => validateProduct({ ...product, variants: [product.variants[0]!, { ...product.variants[0]!, size: 'L' }] }), /SKUs must be unique/)
  assert.throws(() => validateProduct({ ...product, variants: [
    product.variants[0]!,
    { ...product.variants[0]!, sku: 'KHT-001-M-WHITE', color: 'White' },
  ] }), /one active variant per size/)
})

test('product APIs are protected and support create, edit, duplicate and archive', () => {
  for (const path of [
    '../server/api/admin/products/index.get.ts', '../server/api/admin/products/index.post.ts',
    '../server/api/admin/products/[id].get.ts', '../server/api/admin/products/[id].patch.ts',
    '../server/api/admin/products/[id]/duplicate.post.ts', '../server/api/admin/products/[id]/archive.post.ts',
    '../server/api/admin/media.post.ts', '../server/api/admin/media.delete.ts',
  ]) assert.match(read(path), /requireAdmin\(event\)/, path)
})

test('products list uses restrained actions and responsive table/card presentations', () => {
  const page = read('../app/pages/admin/products/index.vue')
  for (const column of ['Image', 'Product', 'Category', 'Price', 'Stock', 'Status', 'Updated']) assert.match(page, new RegExp(`>${column}<`, 'i'))
  assert.match(page, /<details class="admin-row-menu">/)
  for (const action of ['Edit', 'View storefront', 'Duplicate', 'Deactivate']) assert.match(page, new RegExp(action))
  assert.match(page, /admin-products-desktop/)
  assert.match(page, /admin-products-mobile/)
})

test('product editor groups supported fields and uploads one primary image', () => {
  const form = read('../app/components/admin/products/ProductForm.vue')
  for (const section of ['General', 'Media', 'Pricing', 'Variants & inventory']) assert.match(form, new RegExp(`title="${section.replace('&', '&amp;')}|title="${section}`))
  assert.match(form, /\/api\/admin\/media/)
  assert.match(form, /image\/jpeg,image\/png,image\/webp/)
  assert.match(form, /Remove image/)
  assert.doesNotMatch(form, /SEO|alt text|reorder/i)
})

test('media deletion protects referenced images and edit cleanup happens after save', () => {
  const remove = read('../server/api/admin/media.delete.ts')
  const update = read('../server/api/admin/products/[id].patch.ts')
  assert.match(remove, /SELECT id FROM products WHERE image = \?[\s\S]*UNION ALL SELECT id FROM categories WHERE image = \?/)
  assert.match(remove, /This image is still used by a product/)
  assert.ok(update.indexOf('await saveProduct') < update.indexOf('delete(oldKey)'))
})

test('storefront catalog maps active D1 products back to the existing contract', () => {
  const service = read('../server/services/catalog.ts')
  assert.match(service, /WHERE p\.active = 1 AND c\.active = 1/)
  for (const field of ['name', 'description', 'detail', 'fit', 'sizes']) assert.match(service, new RegExp(`${field}:`))
  assert.match(service, /catch \{\s*return fallbackCatalog/)
})

test('product editor and validation use database categories rather than source-code options', () => {
  const service = read('../server/services/adminProducts.ts')
  const form = read('../app/components/admin/products/ProductForm.vue')
  assert.match(service, /SELECT slug FROM categories/)
  assert.match(form, /\/api\/admin\/categories/)
  assert.match(form, /v-for="category in categories \|\| \[\]"/)
  assert.doesNotMatch(form, /<option value="tees">/)
})