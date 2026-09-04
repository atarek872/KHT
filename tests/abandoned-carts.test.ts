import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('the existing bag uses one anonymous server snapshot mechanism', () => {
  const bag = read('../app/composables/useStore.ts')
  assert.match(bag, /useCookie<string>\('kht-cart-id'/)
  assert.match(bag, /\/api\/cart\/snapshot/)
  assert.match(bag, /body: \{ cartId: cartId\.value, items \}/)
  assert.match(bag, /keepalive: true/)
  assert.doesNotMatch(bag, /name:|phone:|email:/)
})

test('cart snapshots are server-priced and store exact validated variants', () => {
  const service = read('../server/services/abandonedCarts.ts')
  assert.match(service, /groupOrderLines/)
  assert.match(service, /assertAvailableStock\(quantity, variant\.stock\)/)
  assert.match(service, /v\.unit_price AS unitPrice/)
  assert.match(service, /`\$\{line\.color\} \/ \$\{line\.size\}`/)
  assert.match(service, /await database\.batch\(/)
})

test('abandoned carts use one 30-minute threshold and exclude cleared carts', () => {
  const service = read('../server/services/abandonedCarts.ts')
  assert.match(service, /abandonmentMinutes = 30/)
  assert.match(service, /state = 'active'/)
  assert.match(service, /datetime\(last_activity\) <= datetime\('now', '-\$\{abandonmentMinutes\} minutes'\)/)
  assert.match(service, /state = 'cleared'/)
})

test('admin abandoned-cart APIs are protected and provide list and detail', () => {
  for (const path of [
    '../server/api/admin/abandoned-carts/index.get.ts',
    '../server/api/admin/abandoned-carts/[id].get.ts',
  ]) assert.match(read(path), /requireAdmin\(event\)/, path)
})

test('abandoned-cart list and detail expose required operational data', () => {
  const list = read('../app/pages/admin/abandoned-carts/index.vue')
  const detail = read('../app/pages/admin/abandoned-carts/[id].vue')
  for (const field of ['Customer', 'Value', 'Items', 'Last activity', 'Recovery', 'Created']) assert.match(list, new RegExp(`>${field}<`, 'i'))
  assert.match(detail, /Products/)
  assert.match(detail, /Contact/)
  assert.match(detail, /Recovery/)
  assert.match(detail, /WhatsApp and email recovery are not configured/)
  assert.doesNotMatch(detail, /sendRecovery|sendWhatsApp|sendEmail|method:\s*'POST'/)
  assert.match(list, /admin-abandoned-desktop/)
  assert.match(list, /admin-abandoned-mobile/)
})

test('dashboard abandoned metrics and rows use the same service', () => {
  const dashboard = read('../server/services/dashboard.ts')
  const endpoint = read('../server/api/admin/dashboard.get.ts')
  assert.match(dashboard, /getAbandonedCartMetrics/)
  assert.match(dashboard, /listAbandonedCarts/)
  assert.match(dashboard, /metric\.key === 'abandonedCarts'/)
  assert.match(endpoint, /buildPersistedDashboardSnapshot\(database, range\)/)
})