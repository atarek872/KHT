import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateCategory } from '../server/services/adminCategories.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('category validation requires localized names, slug, image and integer ordering', () => {
  const category = { slug: 'outerwear', name: { en: 'Outerwear', ar: 'ملابس خارجية' }, image: '/images/outerwear.webp', active: true, sortOrder: 40 }
  assert.doesNotThrow(() => validateCategory(category))
  assert.throws(() => validateCategory({ ...category, slug: 'Outer Wear' }), /lowercase URL slug/)
  assert.throws(() => validateCategory({ ...category, name: { en: '', ar: '' } }), /names are required/)
  assert.throws(() => validateCategory({ ...category, sortOrder: 1.5 }), /whole number/)
})

test('category deletion is rejected when products use it', () => {
  const service = read('../server/services/adminCategories.ts')
  const endpoint = read('../server/api/admin/categories/[id].delete.ts')
  assert.match(service, /if \(category\.productCount > 0\) throw new Error\('CATEGORY_IN_USE'\)/)
  assert.match(endpoint, /message === 'CATEGORY_IN_USE' \? 409/)
  assert.match(endpoint, /Move or archive products before deleting this category/)
})

test('category APIs are authenticated and support list, create, edit and guarded delete', () => {
  for (const path of [
    '../server/api/admin/categories/index.get.ts', '../server/api/admin/categories/index.post.ts',
    '../server/api/admin/categories/[id].get.ts', '../server/api/admin/categories/[id].patch.ts',
    '../server/api/admin/categories/[id].delete.ts',
  ]) assert.match(read(path), /requireAdmin\(event\)/, path)
})

test('category list and editor expose required operations and states', () => {
  const list = read('../app/pages/admin/categories/index.vue')
  const form = read('../app/components/admin/categories/CategoryForm.vue')
  for (const value of ['New category', 'Edit', 'Disable', 'Enable', 'Products', 'Order']) assert.match(list, new RegExp(value))
  for (const value of ['Name — English', 'Name — Arabic', 'URL slug', 'Sort order', 'Visible on storefront', 'Upload category image']) assert.match(form, new RegExp(value))
  assert.match(list, /status === 'pending'/)
  assert.match(list, /v-else-if="error"/)
  assert.match(list, /v-else-if="!data\?\.length"/)
})

test('storefront navigation and catalog categories remain data-driven', () => {
  const catalog = read('../server/services/catalog.ts')
  const header = read('../app/components/SiteHeader.vue')
  const collection = read('../app/components/CollectionView.vue')
  assert.match(catalog, /FROM categories WHERE active = 1 ORDER BY sort_order, name_en/)
  assert.match(catalog, /categories: \(categoriesResult\.results \|\| \[\]\)\.map/)
  assert.match(header, /v-for="category in catalog\.categories"/)
  assert.match(collection, /v-for="cat in catalog\.categories"/)
})

test('renaming a category updates assigned products in the same batch', () => {
  const service = read('../server/services/adminCategories.ts')
  assert.match(service, /UPDATE products SET category = \?, updated_at = \? WHERE category = \?/)
  assert.match(service, /await database\.batch\(statements\)/)
})