import type { DashboardMetric, DashboardRange, DashboardSnapshot } from '../../shared/dashboard'
import type { D1Database } from '../utils/d1'
import { getAbandonedCartMetrics, listAbandonedCarts } from './abandonedCarts.ts'

const ranges: DashboardRange[] = ['today', '7d', '30d']

export function parseDashboardRange(value: unknown): DashboardRange {
  if (typeof value === 'string' && ranges.includes(value as DashboardRange)) {
    return value as DashboardRange
  }
  return '7d'
}

export function buildDashboardSnapshot(
  range: DashboardRange,
  generatedAt = new Date(),
): DashboardSnapshot {
  const unavailable = (
    key: DashboardMetric['key'],
    label: string,
    format: DashboardMetric['format'] = 'number',
  ): DashboardMetric => ({
    key,
    label,
    format,
    value: null,
    availability: 'unavailable',
    note: 'Requires persistent commerce data.',
  })

  return {
    range,
    generatedAt: generatedAt.toISOString(),
    metrics: [
      unavailable('sales', 'Sales', 'currency'),
      unavailable('orders', 'Orders'),
      unavailable('averageOrderValue', 'Average order value', 'currency'),
      unavailable('itemsSold', 'Items sold'),
      unavailable('lowStock', 'Low stock'),
      unavailable('abandonedCarts', 'Abandoned carts'),
      unavailable('recoveredCarts', 'Recovered carts'),
      unavailable('recoveredRevenue', 'Recovered revenue', 'currency'),
    ],
    salesTrend: {
      availability: 'unavailable',
      message: 'Sales history will appear after durable orders are enabled.',
      items: [],
    },
    recentOrders: {
      availability: 'unavailable',
      message: 'Recent orders require a persistent order repository.',
      items: [],
    },
    topProducts: {
      availability: 'unavailable',
      message: 'Product performance requires durable order items.',
      items: [],
    },
    lowStock: {
      availability: 'unavailable',
      message: 'A low-stock threshold and persistent inventory are not configured.',
      items: [],
    },
    abandonedCarts: {
      availability: 'unavailable',
      message: 'Abandoned-cart tracking is not enabled.',
      items: [],
    },
  }
}

function rangeStart(range: DashboardRange, now: Date) {
  if (range === 'today') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  }
  return new Date(now.getTime() - (range === '7d' ? 7 : 30) * 86400000).toISOString()
}

export async function buildPersistedDashboardSnapshot(
  database: D1Database,
  range: DashboardRange,
  now = new Date(),
) {
  const snapshot = buildDashboardSnapshot(range, now)
  const [metrics, carts] = await Promise.all([
    getAbandonedCartMetrics(database, rangeStart(range, now)),
    listAbandonedCarts(database),
  ])
  snapshot.metrics = snapshot.metrics.map((metric) =>
    metric.key === 'abandonedCarts'
      ? { ...metric, value: metrics.abandonedCount, availability: 'available', note: 'Inactive for at least 30 minutes.' }
      : metric,
  )
  snapshot.abandonedCarts = {
    availability: carts.length ? 'available' : 'empty',
    message: carts.length ? 'Recently abandoned carts.' : 'No abandoned carts in the selected view.',
    items: carts.slice(0, 5),
  }
  return snapshot
}