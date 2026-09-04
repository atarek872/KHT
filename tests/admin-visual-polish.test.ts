import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../app/assets/css/admin.css', import.meta.url), 'utf8')

test('admin palette remains monochrome with no accidental brand accents', () => {
  const allowed = new Set([
    '#0a0a0a', '#121212', '#1e1e1e', '#ffffff', '#f5f5f2',
    '#eaeae7', '#d9d9d6', '#8a8a8a', '#181818', '#666666',
  ])
  const colors = new Set((css.match(/#[\da-f]{6}/gi) || []).map((color) => color.toLowerCase()))
  for (const color of colors) assert.equal(allowed.has(color), true, color)
})

test('admin visual system contains no gradients, glass effects, or decorative shadows', () => {
  assert.doesNotMatch(css, /gradient|backdrop-filter/i)
  for (const declaration of css.matchAll(/box-shadow:\s*([^;]+)/gi)) {
    assert.equal(declaration[1]?.trim(), 'none')
  }
})

test('radii and typography remain restrained and consistent', () => {
  const radii = [...css.matchAll(/border-radius:\s*([^;]+)/gi)].map((match) => match[1]?.trim())
  for (const radius of radii) assert.ok(radius === '0' || radius === 'var(--kht-admin-radius)', radius)
  const letterSpacing = [...css.matchAll(/letter-spacing:\s*([^;]+)/gi)].map((match) => match[1]?.trim())
  for (const spacing of letterSpacing) assert.equal(spacing, '0')
})

test('tables use white surfaces, operational density, and structural header lines', () => {
  assert.match(css, /admin-table :is\(th, td\)[\s\S]*padding:\s*12px 16px/)
  assert.match(css, /admin-table th[\s\S]*background:\s*var\(--kht-white\)[\s\S]*border-bottom-color:\s*var\(--kht-gray-800\)/)
  assert.match(css, /admin-table tbody tr:hover[\s\S]*background:\s*var\(--kht-off-white\)/)
})

test('identity lines and branded loading motion are visually unified', () => {
  assert.match(css, /admin-nav__item--active::before[\s\S]*width:\s*1px/)
  assert.match(css, /admin-empty-state__line[\s\S]*width:\s*40px[\s\S]*height:\s*1px/)
  assert.match(css, /dashboard-section-state > span[\s\S]*width:\s*40px[\s\S]*height:\s*1px/)
  assert.match(css, /admin-button__loader::after[\s\S]*900ms ease-in-out infinite alternate/)
  assert.match(css, /admin-loader__track span[\s\S]*900ms ease-in-out infinite alternate/)
})

test('KPI unavailable state is concise rather than repeating technical copy', () => {
  const metric = readFileSync(
    new URL('../app/components/admin/dashboard/DashboardMetric.vue', import.meta.url),
    'utf8',
  )
  assert.match(metric, /'Not available'/)
  assert.doesNotMatch(metric, /<small/)
})

test('admin product and category media use the optimized shared image component', () => {
  for (const path of [
    '../app/components/admin/categories/CategoryForm.vue',
    '../app/components/admin/products/ProductForm.vue',
    '../app/pages/admin/abandoned-carts/[id].vue',
    '../app/pages/admin/categories/index.vue',
    '../app/pages/admin/products/index.vue',
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.match(source, /<StoreImage/)
    assert.doesNotMatch(source, /<img\b/)
  }
})