import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

function luminance(hex: string) {
  const values = hex.match(/[a-f\d]{2}/gi)!.map((value) => {
    const channel = Number.parseInt(value, 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (values[0]! + 0.05) / (values[1]! + 0.05)
}

test('admin text color pairs meet WCAG AA contrast for normal text', () => {
  assert.ok(contrast('#666666', '#ffffff') >= 4.5)
  assert.ok(contrast('#666666', '#f5f5f2') >= 4.5)
  assert.ok(contrast('#8a8a8a', '#0a0a0a') >= 4.5)
  assert.ok(contrast('#181818', '#f5f5f2') >= 4.5)
})

test('focus indicators cover controls, links, summaries, dark sidebar and login', () => {
  const css = read('../app/assets/css/admin.css')
  assert.match(css, /:is\(button, input, select, textarea\):focus-visible/)
  assert.match(css, /:is\(a, summary\):focus-visible/)
  assert.match(css, /outline:\s*2px solid var\(--kht-admin-focus\)/)
  assert.match(css, /admin-sidebar :is\(a, button\):focus-visible[\s\S]*outline-color:\s*var\(--kht-white\)/)
  assert.match(css, /admin-login__submit:focus-visible[\s\S]*outline:\s*2px solid var\(--kht-white\)/)
})

test('form primitives associate visible labels, help, errors, and invalid state', () => {
  for (const component of ['AdminInput.vue', 'AdminSelect.vue', 'AdminTextarea.vue']) {
    const source = read(`../app/components/admin/${component}`)
    assert.match(source, /<label/)
    assert.match(source, /:for="fieldId"/)
    assert.match(source, /:aria-describedby="describedBy"/)
    assert.match(source, /:aria-invalid="error \? 'true' : undefined"/)
    assert.match(source, /role="alert"/)
  }
  const checkbox = read('../app/components/admin/AdminCheckbox.vue')
  assert.match(checkbox, /:for="fieldId"/)
  assert.match(checkbox, /:aria-describedby="describedBy"/)
})

test('loading and disabled buttons retain understandable text and semantics', () => {
  const button = read('../app/components/admin/AdminButton.vue')
  const loader = read('../app/components/admin/AdminLoader.vue')
  assert.match(button, /:disabled="disabled \|\| loading"/)
  assert.match(button, /:aria-busy="loading \|\| undefined"/)
  assert.match(button, /loading \? loadingLabel/)
  assert.match(loader, /role="status"/)
  assert.match(loader, /\{\{ label \}\}/)
})

test('native dialogs trap focus, close with Escape, restore focus, and default confirmations safely', () => {
  const modal = read('../app/components/admin/AdminModal.vue')
  const navigation = read('../app/components/admin/AdminMobileNavigation.vue')
  const confirm = read('../app/components/admin/AdminConfirmDialog.vue')
  for (const source of [modal, navigation]) {
    assert.match(source, /<dialog/)
    assert.match(source, /\.showModal\(\)/)
    assert.match(source, /@cancel\.prevent/)
    assert.match(source, /restoreFocus\?\.focus\(\)/)
  }
  assert.match(confirm, /autofocus/)
  assert.match(confirm, /variant="quiet"/)
})

test('all admin table headers identify their columns', () => {
  for (const path of [
    '../app/pages/admin/orders/index.vue',
    '../app/pages/admin/products/index.vue',
    '../app/pages/admin/inventory/index.vue',
    '../app/pages/admin/customers/index.vue',
    '../app/pages/admin/abandoned-carts/index.vue',
  ]) {
    const source = read(path)
    const headers = [...source.matchAll(/<th\b[^>]*>/g)].map((match) => match[0])
    assert.ok(headers.length, path)
    for (const header of headers) assert.match(header, /scope="col"/, `${path}: ${header}`)
    assert.match(source, /<thead>/)
    assert.match(source, /<tbody>/)
  }
  const table = read('../app/components/admin/AdminTable.vue')
  assert.match(table, /role="region"/)
  assert.match(table, /:aria-label="label"/)
})

test('important statuses use visible text in addition to visual treatment', () => {
  const orderStatus = read('../app/components/admin/orders/OrderStatus.vue')
  const inventory = read('../app/pages/admin/inventory/index.vue')
  const products = read('../app/pages/admin/products/index.vue')
  assert.match(orderStatus, /\{\{ text \}\}/)
  assert.match(inventory, /item\.lowStock \? 'Low stock' : 'In stock'/)
  assert.match(inventory, />Inactive</)
  assert.match(products, /product\.active \? 'Active' : 'Inactive'/)
})

test('empty, error, success, disabled, loading and unauthorized states are announced', () => {
  const empty = read('../app/components/admin/AdminEmptyState.vue')
  const login = read('../app/pages/admin/login.vue')
  const middleware = read('../app/middleware/admin-auth.global.ts')
  const createOrder = read('../app/pages/admin/orders/new.vue')
  const product = read('../app/pages/admin/products/[id].vue')
  assert.match(empty, /:role="live === 'assertive' \? 'alert' : 'status'"/)
  assert.match(empty, /:aria-live="live"/)
  assert.match(login, /session is unavailable or expired/)
  assert.match(login, /:aria-invalid="error \? 'true' : undefined"/)
  assert.match(login, /admin-login-error/g)
  assert.match(middleware, /reason: 'unauthorized'/)
  assert.match(createOrder, /title="Order created"/)
  assert.match(product, /role="status"/)
})