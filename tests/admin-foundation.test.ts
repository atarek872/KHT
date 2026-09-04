import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('admin stylesheet defines the approved tokens inside the admin scope', () => {
  const css = read('../app/assets/css/admin.css')
  const tokens = {
    '--kht-black': '#0a0a0a',
    '--kht-black-2': '#121212',
    '--kht-graphite': '#1e1e1e',
    '--kht-white': '#ffffff',
    '--kht-off-white': '#f5f5f2',
    '--kht-gray-100': '#eaeae7',
    '--kht-gray-200': '#d9d9d6',
    '--kht-gray-500': '#8a8a8a',
    '--kht-gray-800': '#181818',
  }

  assert.match(css, /^\.kht-admin\s*\{/)
  for (const [token, value] of Object.entries(tokens)) {
    assert.match(css, new RegExp(`${token}:\\s*${value}`, 'i'), token)
  }
  assert.doesNotMatch(css, /gradient|backdrop-filter/i)
  for (const shadow of css.matchAll(/box-shadow:\s*([^;]+)/gi)) {
    assert.equal(shadow[1]?.trim(), 'none')
  }
})

test('admin form controls expose labels, descriptions and validation semantics', () => {
  for (const component of ['AdminInput.vue', 'AdminSelect.vue', 'AdminTextarea.vue']) {
    const source = read(`../app/components/admin/${component}`)
    assert.match(source, /<label/)
    assert.match(source, /aria-describedby/)
    assert.match(source, /aria-invalid/)
    assert.match(source, /role="alert"/)
  }
})

test('admin loading and dialog primitives expose native interaction semantics', () => {
  const button = read('../app/components/admin/AdminButton.vue')
  const modal = read('../app/components/admin/AdminModal.vue')
  const loader = read('../app/components/admin/AdminLoader.vue')

  assert.match(button, /:disabled="disabled \|\| loading"/)
  assert.match(button, /:aria-busy="loading \|\| undefined"/)
  assert.match(modal, /<dialog/)
  assert.match(modal, /@cancel\.prevent/)
  assert.match(modal, /restoreFocus\?\.focus\(\)/)
  assert.match(loader, /role="status"/)
})

test('nested admin components used with short names are imported explicitly', () => {
  const usages: Record<string, string[]> = {
    'DashboardMetric.vue': ['../app/pages/admin/index.vue'],
    'DashboardSectionState.vue': [
      '../app/pages/admin/index.vue',
      '../app/pages/admin/customers/[id].vue',
    ],
    'OrderStatus.vue': [
      '../app/pages/admin/orders/index.vue',
      '../app/pages/admin/orders/[id].vue',
      '../app/pages/admin/customers/[id].vue',
    ],
    'ProductForm.vue': [
      '../app/pages/admin/products/new.vue',
      '../app/pages/admin/products/[id].vue',
    ],
    'CategoryForm.vue': [
      '../app/pages/admin/categories/new.vue',
      '../app/pages/admin/categories/[id].vue',
    ],
    'DiscountForm.vue': [
      '../app/pages/admin/discounts/new.vue',
      '../app/pages/admin/discounts/[id].vue',
    ],
    'ShippingZoneForm.vue': [
      '../app/pages/admin/shipping/new.vue',
      '../app/pages/admin/shipping/[governorate].vue',
    ],
  }
  for (const [component, paths] of Object.entries(usages)) {
    for (const path of paths) assert.match(read(path), new RegExp(`import .+ from '.+${component}'`), path)
  }
})