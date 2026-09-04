import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('default layout preserves the storefront shell while app delegates layouts', () => {
  const app = read('../app/app.vue')
  const layout = read('../app/layouts/default.vue')

  assert.match(app, /<NuxtLayout><NuxtPage \/><\/NuxtLayout>/)
  for (const component of ['<SiteHeader />', '<SiteFooter />', '<BagDrawer />']) {
    assert.match(layout, new RegExp(component.replace(/[<>/]/g, '\\$&')))
  }
  assert.match(layout, /useFetch\('\/api\/catalog'\)/)
})

test('admin navigation links only to the dashboard route that currently exists', () => {
  const sidebar = read('../app/components/admin/AdminSidebar.vue')
  const route = read('../app/pages/admin/index.vue')

  assert.match(sidebar, /\{ label: 'Dashboard', to: '\/admin' \}/)
  assert.match(sidebar, /\{ label: 'Orders', to: '\/admin\/orders' \}/)
  assert.match(sidebar, /\{ label: 'Products', to: '\/admin\/products' \}/)
  assert.match(sidebar, /\{ label: 'Inventory', to: '\/admin\/inventory' \}/)
  assert.match(sidebar, /\{ label: 'Categories', to: '\/admin\/categories' \}/)
  assert.match(sidebar, /\{ label: 'Customers', to: '\/admin\/customers' \}/)
  assert.match(sidebar, /\{ label: 'Discounts', to: '\/admin\/discounts' \}/)
  assert.match(sidebar, /\{ label: 'Shipping', to: '\/admin\/shipping' \}/)
  assert.match(sidebar, /\{ label: 'Abandoned Carts', to: '\/admin\/abandoned-carts' \}/)
  for (const label of [
    'Settings',
  ]) {
    assert.match(sidebar, new RegExp(`\\{ label: '${label}' \\}`))
  }
  assert.doesNotMatch(sidebar, /to: '\/admin\/settings/)
  assert.match(route, /layout: 'admin'/)
})

test('admin shell defines persistent desktop and off-canvas responsive navigation', () => {
  const css = read('../app/assets/css/admin.css')
  const mobileNavigation = read('../app/components/admin/AdminMobileNavigation.vue')

  assert.match(css, /grid-template-columns:\s*240px minmax\(0, 1fr\)/)
  assert.match(css, /@media \(max-width: 1023px\)/)
  assert.match(css, /@media \(min-width: 1024px\)/)
  assert.match(css, /width:\s*min\(320px, calc\(100vw - 48px\)\)/)
  assert.match(mobileNavigation, /<dialog/)
  assert.match(mobileNavigation, /@cancel\.prevent/)
  assert.match(mobileNavigation, /matchMedia\('\(min-width: 1024px\)'\)/)
})