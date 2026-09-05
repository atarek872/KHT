import type {
  DashboardLowStockItem,
  DashboardMetric,
  DashboardRange,
  DashboardRecentOrder,
  DashboardSnapshot,
  DashboardTopProduct,
} from '../../shared/dashboard'
import type { D1Database } from '../utils/d1'
import { getAbandonedCartMetrics, listAbandonedCarts } from './abandonedCarts.ts'
import { lowStockThreshold } from './inventory.ts'

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
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    ).toISOString()
  }
  return new Date(now.getTime() - (range === '7d' ? 7 : 30) * 86400000).toISOString()
}

export async function buildPersistedDashboardSnapshot(
  database: D1Database,
  range: DashboardRange,
  now = new Date(),
): Promise<DashboardSnapshot> {
  const snapshot = buildDashboardSnapshot(range, now)
  const start = rangeStart(range, now)
  const [
    commerce,
    itemsSold,
    salesTrend,
    recentOrders,
    topProducts,
    lowStock,
    recoveryMetrics,
    carts,
  ] = await Promise.all([
    database
      .prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN payment_status = 'paid'
            AND fulfillment_status NOT IN ('cancelled', 'returned') THEN total ELSE 0 END), 0) AS sales,
          COUNT(*) AS orderCount,
          COALESCE(AVG(CASE WHEN payment_status = 'paid'
            AND fulfillment_status NOT IN ('cancelled', 'returned') THEN total END), 0) AS averageOrderValue
        FROM orders WHERE datetime(created_at) >= datetime(?)`,
      )
      .bind(start)
      .first<{ sales: number; orderCount: number; averageOrderValue: number }>(),
    database
      .prepare(
        `SELECT COALESCE(SUM(oi.quantity), 0) AS value
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE datetime(o.created_at) >= datetime(?) AND o.payment_status = 'paid'
          AND o.fulfillment_status NOT IN ('cancelled', 'returned')`,
      )
      .bind(start)
      .first<{ value: number }>(),
    database
      .prepare(
        `SELECT date(created_at) AS date, SUM(total) AS sales
        FROM orders WHERE datetime(created_at) >= datetime(?) AND payment_status = 'paid'
          AND fulfillment_status NOT IN ('cancelled', 'returned')
        GROUP BY date(created_at) ORDER BY date(created_at)`,
      )
      .bind(start)
      .all<{ date: string; sales: number }>(),
    database
      .prepare(
        `SELECT o.id, o.number, c.name AS customerName, o.total,
          o.payment_status AS paymentStatus, o.fulfillment_status AS fulfillmentStatus,
          o.created_at AS createdAt
        FROM orders o JOIN customers c ON c.id = o.customer_id
        WHERE datetime(o.created_at) >= datetime(?)
        ORDER BY datetime(o.created_at) DESC, o.rowid DESC LIMIT 5`,
      )
      .bind(start)
      .all<DashboardRecentOrder>(),
    database
      .prepare(
        `SELECT oi.product_name AS productName, SUM(oi.quantity) AS quantity,
          SUM(oi.total) AS revenue
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE datetime(o.created_at) >= datetime(?) AND o.payment_status = 'paid'
          AND o.fulfillment_status NOT IN ('cancelled', 'returned')
        GROUP BY oi.product_name ORDER BY quantity DESC, revenue DESC, productName LIMIT 5`,
      )
      .bind(start)
      .all<DashboardTopProduct>(),
    database
      .prepare(
        `SELECT v.id, p.name_en AS productName, v.sku, v.size, v.color, v.stock
        FROM inventory_variants v JOIN products p ON p.id = v.product_id
        WHERE v.active = 1 AND p.active = 1 AND v.stock <= ?
        ORDER BY v.stock, p.name_en, v.size LIMIT 5`,
      )
      .bind(lowStockThreshold)
      .all<DashboardLowStockItem>(),
    getAbandonedCartMetrics(database, rangeStart(range, now)),
    listAbandonedCarts(database),
  ])

  const commerceValues = {
    sales: Number(commerce?.sales || 0),
    orders: Number(commerce?.orderCount || 0),
    averageOrderValue: Math.round(Number(commerce?.averageOrderValue || 0)),
    itemsSold: Number(itemsSold?.value || 0),
    lowStock: Number(lowStock.results?.length || 0),
  }
  snapshot.metrics = snapshot.metrics.map((metric) => {
    if (metric.key in commerceValues) {
      return {
        ...metric,
        value: commerceValues[metric.key as keyof typeof commerceValues],
        availability: 'available' as const,
        note:
          metric.key === 'sales' || metric.key === 'averageOrderValue'
            ? 'Paid COD orders in the selected period.'
            : metric.key === 'lowStock'
              ? `Active variants with ${lowStockThreshold} units or fewer.`
              : '',
      }
    }
    if (metric.key === 'abandonedCarts') {
      return {
        ...metric,
        value: recoveryMetrics.abandonedCount,
        availability: 'available' as const,
        note: 'Inactive for at least 30 minutes.',
      }
    }
    if (metric.key === 'recoveredCarts') {
      return {
        ...metric,
        value: recoveryMetrics.recoveredCount,
        availability: 'available' as const,
        note: '',
      }
    }
    if (metric.key === 'recoveredRevenue') {
      return {
        ...metric,
        value: recoveryMetrics.recoveredRevenue,
        availability: 'available' as const,
        note: '',
      }
    }
    return metric
  })

  const section = <T>(items: T[], populated: string, empty: string) => ({
    availability: items.length ? ('available' as const) : ('empty' as const),
    message: items.length ? populated : empty,
    items,
  })
  snapshot.salesTrend = section(
    (salesTrend.results || []).map((item) => ({ ...item, sales: Number(item.sales) })),
    'Paid COD revenue by day.',
    'No paid COD revenue in this period.',
  )
  snapshot.recentOrders = section(
    recentOrders.results || [],
    'Latest orders in the selected period.',
    'No orders in this period.',
  )
  snapshot.topProducts = section(
    (topProducts.results || []).map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      revenue: Number(item.revenue),
    })),
    'Products ranked by paid item quantity.',
    'No paid products in this period.',
  )
  snapshot.lowStock = section(
    lowStock.results || [],
    'Active variants that need attention.',
    'No active variants are low on stock.',
  )
  snapshot.abandonedCarts = {
    availability: carts.length ? 'available' : 'empty',
    message: carts.length
      ? 'Recently abandoned carts.'
      : 'No abandoned carts in the selected view.',
    items: carts.slice(0, 5),
  }
  return snapshot
}
