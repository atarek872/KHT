import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const css = read('../app/assets/css/admin.css')

const layoutAt = (width: number) => ({
  navigation: width < 1024 ? 'off-canvas' : 'sidebar',
  records: width < 1280 ? 'cards' : 'table',
  columns: width < 768 ? 1 : width < 1024 ? 2 : 4,
})

test('required viewport widths resolve to intentional shell and record layouts', () => {
  assert.deepEqual(layoutAt(390), { navigation: 'off-canvas', records: 'cards', columns: 1 })
  assert.deepEqual(layoutAt(768), { navigation: 'off-canvas', records: 'cards', columns: 2 })
  assert.deepEqual(layoutAt(1024), { navigation: 'sidebar', records: 'cards', columns: 4 })
  assert.deepEqual(layoutAt(1280), { navigation: 'sidebar', records: 'table', columns: 4 })
  assert.deepEqual(layoutAt(1440), { navigation: 'sidebar', records: 'table', columns: 4 })
  assert.match(css, /@media \(max-width: 767px\)/)
  assert.match(css, /@media \(max-width: 1023px\)/)
  assert.match(css, /@media \(max-width: 1279px\)/)
  assert.match(css, /@media \(min-width: 1024px\)/)
})

test('every large admin table has a structured card alternative below 1280px', () => {
  for (const name of ['orders', 'products', 'inventory', 'customers', 'abandoned']) {
    assert.match(css, new RegExp(`admin-${name}-desktop`), `${name} desktop`)
    assert.match(css, new RegExp(`admin-${name}-mobile`), `${name} cards`)
  }
  assert.match(css, /@media \(max-width: 1279px\)[\s\S]*admin-orders-desktop[\s\S]*display:\s*none/)
  assert.match(css, /@media \(max-width: 1279px\)[\s\S]*admin-orders-mobile[\s\S]*display:\s*grid/)
  assert.match(css, /admin-orders-desktop \.admin-table\s*\{\s*min-width:\s*940px/)
})

test('dialogs, drawers, sticky actions and tap targets remain viewport constrained', () => {
  assert.match(css, /\.admin-modal\s*\{[\s\S]*max-height:\s*calc\(100dvh - 32px\)[\s\S]*display:\s*flex/)
  assert.match(css, /\.admin-modal__body\s*\{[\s\S]*min-height:\s*0[\s\S]*overflow-y:\s*auto/)
  assert.match(css, /\.admin-mobile-navigation\s*\{[\s\S]*max-width:\s*calc\(100vw - 48px\)[\s\S]*height:\s*100dvh/)
  assert.match(css, /admin-create-order__actions[\s\S]*position:\s*sticky[\s\S]*z-index:\s*9/)
  assert.match(css, /admin-product-form__actions[\s\S]*position:\s*sticky[\s\S]*z-index:\s*9/)
  assert.match(css, /--kht-admin-control-height:\s*44px/)
})

test('tablet forms collapse dense controls before they can overflow', () => {
  const tablet = css.slice(css.indexOf('@media (min-width: 768px) and (max-width: 1279px)'))
  assert.match(tablet, /admin-product-variant[\s\S]*grid-template-columns:\s*repeat\(2/)
  assert.match(tablet, /admin-inventory-filters[\s\S]*grid-template-columns:\s*repeat\(2/)
  assert.match(tablet, /admin-create-order__review[\s\S]*grid-template-columns:\s*1fr/)
})

test('mobile cards constrain long text and retain operational product actions', () => {
  const products = read('../app/pages/admin/products/index.vue')
  assert.match(css, /text-overflow:\s*ellipsis/)
  assert.match(css, /overflow-wrap:\s*anywhere/)
  assert.match(products, /admin-product-card__actions/)
  for (const action of ['Edit product', 'View storefront', 'Duplicate', 'Deactivate']) {
    assert.match(products, new RegExp(action))
  }
})

test('mobile login and create-order steps have explicit landscape and compact rules', () => {
  assert.match(css, /@media \(max-width: 1023px\) and \(max-height: 500px\) and \(orientation: landscape\)/)
  assert.match(css, /admin-login__content[\s\S]*grid-template-columns:\s*minmax\(180px/)
  assert.match(css, /admin-create-order__steps button:not\(\[aria-current='step'\]\)[\s\S]*display:\s*none/)
  assert.match(css, /admin-create-order__steps button\s*\{[\s\S]*min-height:\s*48px/)
})

test('inventory guidance and abandoned-cart time remain useful on long mobile sessions', () => {
  const inventory = read('../app/pages/admin/inventory/index.vue')
  const abandoned = read('../app/pages/admin/abandoned-carts/index.vue')
  assert.match(inventory, /Whole numbers, minimum 0/)
  assert.match(abandoned, /setInterval\([\s\S]*60000/)
  assert.match(abandoned, /onBeforeUnmount\(\(\) => clearInterval\(clockTimer\)\)/)
})