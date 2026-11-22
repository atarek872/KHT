import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildDashboardSnapshot,
  buildPersistedDashboardSnapshot,
  parseDashboardRange,
} from '../server/services/dashboard.ts'
import { createTestD1 } from './helpers/sqliteD1.ts'

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
  assert.equal(dashboard.metrics.length, 14)
  for (const metric of dashboard.metrics) {
    assert.equal(metric.value, null)
    assert.equal(metric.availability, 'unavailable')
  }
  for (const section of [
    dashboard.salesTrend,
    dashboard.recentOrders,
    dashboard.topProducts,
    dashboard.sourcePerformance,
    dashboard.lowStock,
    dashboard.abandonedCarts,
  ]) {
    assert.equal(section.availability, 'unavailable')
    assert.deepEqual(section.items, [])
    assert.ok(section.message)
  }
  assert.equal(dashboard.forecast.value, null)
  assert.deepEqual(dashboard.priorities, [])
})

test('dashboard page uses one aggregate endpoint and includes every required section', () => {
  const page = read('../app/pages/admin/index.vue')

  assert.equal(page.match(/useFetch</g)?.length, 1)
  assert.match(page, /'\/api\/admin\/dashboard'/)
  assert.match(page, /query: \{ range \}/)
  for (const section of [
    'نظرة عامة',
    'اتجاه الطلبات المدفوعة',
    'أحدث الطلبات',
    'المنتجات',
    'مصادر الطلبات',
    'المخزون',
    'السلات المتروكة',
    'أولويات العمل',
  ]) {
    assert.match(page, new RegExp(section, 'i'), section)
  }
  for (const period of ['اليوم', '٧ أيام', '٣٠ يومًا']) {
    assert.match(page, new RegExp(period), period)
  }
  for (const collection of ['salesTrend', 'recentOrders', 'topProducts', 'lowStock']) {
    assert.match(page, new RegExp(`data\\.${collection}\\.items`), collection)
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

test('persisted dashboard reports real COD commerce and inventory data', async () => {
  const { database, sqlite, close } = createTestD1()
  try {
    for (const name of [
      '0001_commerce.sql',
      '0002_products.sql',
      '0003_categories.sql',
      '0004_discounts.sql',
      '0005_abandoned_carts.sql',
      '0006_commerce_safety.sql',
      '0007_production_commerce.sql',
      '0019_cart_recovery_email.sql',
      '0020_recovery_admin_settings.sql',
    ]) {
      sqlite.exec(read(`../server/db/migrations/${name}`))
    }
    sqlite.exec(`
      INSERT INTO customers (id, name, phone, email, address, governorate, city)
      VALUES ('dashboard-customer', 'Dashboard Customer', '01010000111', NULL, '1 Test Street', 'Cairo', 'Cairo');
      INSERT INTO orders
        (id, number, idempotency_key, customer_id, subtotal, shipping, discount, total,
         payment_method, payment_status, fulfillment_status, source, created_at, public_reference,
         shipping_governorate)
      VALUES
        ('dashboard-paid', 'KHT-DASH-1', 'dash-paid', 'dashboard-customer', 1780, 60, 0, 1840,
         'cod', 'pending', 'pending', 'website', '2026-09-05 09:00:00', 'KHT-DASH-1-REF',
         'Cairo'),
        ('dashboard-pending', 'KHT-DASH-2', 'dash-pending', 'dashboard-customer', 890, 60, 0, 950,
         'cod', 'pending', 'pending', 'phone', '2026-09-05 10:00:00', 'KHT-DASH-2-REF',
         'Cairo');
      UPDATE orders SET payment_status = 'paid', fulfillment_status = 'delivered'
      WHERE id = 'dashboard-paid';
      INSERT INTO order_items
        (id, order_id, variant_id, product_name, variant, sku, quantity, unit_price, total)
      VALUES
        ('dashboard-item-1', 'dashboard-paid', 'kht-001-s', 'The Line Tee', 'Black / S',
         'KHT-001-S', 2, 890, 1780),
        ('dashboard-item-2', 'dashboard-pending', 'kht-001-m', 'The Line Tee', 'Black / M',
         'KHT-001-M', 1, 890, 890);
      INSERT INTO abandoned_carts (id, subtotal, items_count, created_at, last_activity)
      VALUES
        ('dashboard-old-cart', 890, 1, '2026-09-02 09:00:00', '2026-09-02 09:00:00'),
        ('dashboard-new-cart', 890, 1, '2026-09-05 08:00:00', '2026-09-05 08:00:00');
    `)

    const dashboard = await buildPersistedDashboardSnapshot(
      database,
      'today',
      new Date('2026-09-05T12:00:00.000Z'),
    )
    const metric = (key: string) => dashboard.metrics.find((item) => item.key === key)

    assert.deepEqual(
      {
        sales: metric('sales')?.value,
        orders: metric('orders')?.value,
        averageOrderValue: metric('averageOrderValue')?.value,
        itemsSold: metric('itemsSold')?.value,
        placedValue: metric('placedValue')?.value,
        awaitingAction: metric('awaitingAction')?.value,
        delivered: metric('delivered')?.value,
      },
      {
        sales: 1840,
        orders: 2,
        averageOrderValue: 1840,
        itemsSold: 2,
        placedValue: 2790,
        awaitingAction: 1,
        delivered: 1,
      },
    )
    assert.equal(dashboard.forecast.value, null)
    assert.ok(dashboard.priorities.some((priority) => priority.key === 'pending'))
    assert.equal(metric('lowStock')?.availability, 'available')
    assert.ok(Number(metric('lowStock')?.value) > 0)
    assert.deepEqual(dashboard.salesTrend.items, [{ date: '2026-09-05', sales: 1840 }])
    assert.equal(dashboard.recentOrders.items.length, 2)
    assert.equal(dashboard.recentOrders.items[0]?.number, 'KHT-DASH-2')
    assert.deepEqual(dashboard.topProducts.items[0], {
      productName: 'The Line Tee',
      quantity: 2,
      revenue: 1780,
    })
    assert.ok(dashboard.lowStock.items.length > 0)
    assert.equal(metric('abandonedCarts')?.value, 1)
    assert.deepEqual(
      dashboard.abandonedCarts.items.map((cart) => cart.id),
      ['dashboard-new-cart'],
    )
    assert.deepEqual(dashboard.sourcePerformance.items, [
      { source: 'phone', orders: 1, paidValue: 0 },
      { source: 'website', orders: 1, paidValue: 1840 },
    ])
    for (const section of [
      dashboard.salesTrend,
      dashboard.recentOrders,
      dashboard.topProducts,
      dashboard.lowStock,
    ]) {
      assert.equal(section.availability, 'available')
    }
  } finally {
    close()
  }
})

test('dashboard forecast requires three paid orders on distinct days and explains the projection', async () => {
  const { database, sqlite, close } = createTestD1()
  try {
    for (const name of [
      '0001_commerce.sql',
      '0002_products.sql',
      '0003_categories.sql',
      '0004_discounts.sql',
      '0005_abandoned_carts.sql',
      '0006_commerce_safety.sql',
      '0007_production_commerce.sql',
      '0019_cart_recovery_email.sql',
      '0020_recovery_admin_settings.sql',
    ]) {
      sqlite.exec(read(`../server/db/migrations/${name}`))
    }
    sqlite.exec(`INSERT INTO customers (id, name, phone, address, governorate, city)
      VALUES ('forecast-customer', 'Test', '01010000112', 'Street', 'Cairo', 'Cairo');`)
    for (const [index, day] of ['01', '03', '05'].entries()) {
      sqlite.exec(`INSERT INTO orders (id, number, idempotency_key, customer_id, subtotal, shipping, discount, total, payment_method, payment_status, fulfillment_status, source, created_at, public_reference, shipping_governorate)
        VALUES ('forecast-${index}', 'KHT-F-${index}', 'f-${index}', 'forecast-customer', 900, 60, 0, 960, 'cod', 'pending', 'pending', 'website', '2026-09-${day} 09:00:00', 'KHT-F-${index}-REF', 'Cairo');
        UPDATE orders SET payment_status='paid', fulfillment_status='delivered' WHERE id='forecast-${index}';`)
    }
    const dashboard = await buildPersistedDashboardSnapshot(
      database,
      '7d',
      new Date('2026-09-08T00:00:00.000Z'),
    )
    assert.equal(dashboard.forecast.value, 2880)
    assert.equal(dashboard.forecast.sampleOrders, 3)
    assert.match(dashboard.forecast.method, /٧ أيام/)
    assert.equal(
      dashboard.priorities.some((priority) => priority.key === 'pending'),
      false,
    )
  } finally {
    close()
  }
})
