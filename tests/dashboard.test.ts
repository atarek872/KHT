import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildDashboardSnapshot, parseDashboardRange } from '../server/services/dashboard.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('dashboard accepts only supported ranges', () => {
  assert.equal(parseDashboardRange('today'), 'today')
  assert.equal(parseDashboardRange('7d'), '7d')
  assert.equal(parseDashboardRange('30d'), '30d')
  assert.equal(parseDashboardRange('all'), '7d')
  assert.equal(parseDashboardRange(['7d']), '7d')
})

test('dashboard never invents metrics when commerce persistence is unavailable', () => {
  const generatedAt = new Date('2026-09-04T12:00:00.000Z')
  const dashboard = buildDashboardSnapshot('30d', generatedAt)

  assert.equal(dashboard.range, '30d')
  assert.equal(dashboard.generatedAt, generatedAt.toISOString())
  assert.equal(dashboard.metrics.length, 8)
  for (const metric of dashboard.metrics) {
    assert.equal(metric.value, null)
    assert.equal(metric.availability, 'unavailable')
  }
  for (const section of [
    dashboard.salesTrend,
    dashboard.recentOrders,
    dashboard.topProducts,
    dashboard.lowStock,
    dashboard.abandonedCarts,
  ]) {
    assert.equal(section.availability, 'unavailable')
    assert.deepEqual(section.items, [])
    assert.ok(section.message)
  }
})

test('dashboard page uses one aggregate endpoint and includes every required section', () => {
  const page = read('../app/pages/admin/index.vue')

  assert.equal(page.match(/useFetch</g)?.length, 1)
  assert.match(page, /'\/api\/admin\/dashboard'/)
  assert.match(page, /query: \{ range \}/)
  for (const section of [
    'Overview',
    'Sales trend',
    'Recent orders',
    'Top products',
    'Low stock',
    'Abandoned carts',
  ]) {
    assert.match(page, new RegExp(section, 'i'), section)
  }
  for (const period of ['Today', '7 days', '30 days']) {
    assert.match(page, new RegExp(period), period)
  }
})

test('dashboard page has loading, error, retry and responsive state contracts', () => {
  const page = read('../app/pages/admin/index.vue')
  const css = read('../app/assets/css/admin.css')

  assert.match(page, /status === 'pending'/)
  assert.match(page, /v-else-if="error"/)
  assert.match(page, /@click="refresh\(\)"/)
  assert.match(page, /DashboardSectionState/)
  assert.match(css, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(css, /@media \(max-width: 767px\)/)
  assert.match(css, /@media \(min-width: 768px\) and \(max-width: 1279px\)/)
  assert.doesNotMatch(css.slice(css.indexOf('.kht-admin .admin-dashboard')), /gradient/i)
})