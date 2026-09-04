import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('admin login uses its isolated full-screen layout and required content', () => {
  const page = read('../app/pages/admin/login.vue')
  const layout = read('../app/layouts/admin-auth.vue')

  assert.match(page, /layout: 'admin-auth'/)
  for (const content of ['KHT', 'Admin access', 'Login', 'Email', 'Password']) {
    assert.match(page, new RegExp(`>${content}<`, 'i'), content)
  }
  assert.match(page, /busy \? 'Signing in' : 'Sign in'/)
  assert.match(page, /Black\. White\. Line\./)
  assert.match(layout, /class="kht-admin admin-auth-layout"/)
})

test('admin login provides native submission, password visibility and accessible states', () => {
  const page = read('../app/pages/admin/login.vue')

  assert.match(page, /<form[^>]+@submit\.prevent="submit"/)
  assert.match(page, /type="email"/)
  assert.match(page, /autocomplete="username"/)
  assert.match(page, /autocomplete="current-password"/)
  assert.match(page, /:type="passwordVisible \? 'text' : 'password'"/)
  assert.match(page, /:aria-pressed="passwordVisible"/)
  assert.match(page, /:disabled="busy"/)
  assert.match(page, /:aria-busy="busy"/)
  assert.match(page, /role="alert"/)
})

test('admin login distinguishes credential failures and restricts redirects to admin routes', () => {
  const page = read('../app/pages/admin/login.vue')

  assert.match(page, /status === 401/)
  assert.match(page, /Email or password is incorrect/)
  assert.match(page, /Admin access is unavailable/)
  assert.match(page, /redirect === '\/admin' \|\| redirect\.startsWith\('\/admin\/'\)/)
  assert.match(page, /!redirect\.startsWith\('\/admin\/login'\)/)
  assert.match(page, /await navigateTo\(safeRedirect\(\)\)/)
})

test('admin login CSS stays monochrome and includes responsive focus and loading treatment', () => {
  const css = read('../app/assets/css/admin.css')
  const loginCss = css.slice(css.indexOf('.kht-admin-auth-body'))

  assert.match(loginCss, /background:\s*var\(--kht-black\)/)
  assert.match(loginCss, /outline:\s*2px solid var\(--kht-white\)/)
  assert.match(loginCss, /admin-login__progress/)
  assert.match(loginCss, /@media \(max-width: 767px\)/)
  assert.match(loginCss, /@media \(min-width: 768px\) and \(max-width: 1023px\)/)
  assert.doesNotMatch(loginCss, /gradient|backdrop-filter/i)
})