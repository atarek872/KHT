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
      unavailable('sales', 'قيمة الطلبات المدفوعة', 'currency'),
      unavailable('placedValue', 'قيمة الطلبات المسجلة', 'currency'),
      unavailable('orders', 'عدد الطلبات'),
      unavailable('paidOrders', 'طلبات مدفوعة'),
      unavailable('averageOrderValue', 'متوسط الطلب المدفوع', 'currency'),
      unavailable('itemsSold', 'قطع في طلبات مدفوعة'),
      unavailable('awaitingAction', 'طلبات تحتاج تأكيدًا'),
      unavailable('onDelivery', 'طلبات في طريقها للعميل'),
      unavailable('delivered', 'طلبات تم تسليمها'),
      unavailable('cancelled', 'طلبات ملغاة'),
      unavailable('lowStock', 'مقاسات قليلة المخزون'),
      unavailable('abandonedCarts', 'سلات متروكة'),
      unavailable('recoveredCarts', 'سلات تم استعادتها'),
      unavailable('recoveredRevenue', 'قيمة الاستعادة', 'currency'),
    ],
    salesTrend: {
      availability: 'unavailable',
      message: 'سجل التحصيل غير متاح حاليًا.',
      items: [],
    },
    recentOrders: {
      availability: 'unavailable',
      message: 'الطلبات الأخيرة غير متاحة حاليًا.',
      items: [],
    },
    topProducts: {
      availability: 'unavailable',
      message: 'أداء المنتجات غير متاح حاليًا.',
      items: [],
    },
    sourcePerformance: {
      availability: 'unavailable',
      message: 'مصادر الطلبات غير متاحة حاليًا.',
      items: [],
    },
    lowStock: {
      availability: 'unavailable',
      message: 'بيانات المخزون غير متاحة حاليًا.',
      items: [],
    },
    abandonedCarts: {
      availability: 'unavailable',
      message: 'بيانات السلات المتروكة غير متاحة حاليًا.',
      items: [],
    },
    forecast: { value: null, sampleOrders: 0, method: 'لا تتوفر بيانات كافية للتقدير.' },
    priorities: [],
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
    sourcePerformance,
    lowStock,
    lowStockCount,
    recoveryMetrics,
    carts,
  ] = await Promise.all([
    database
      .prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN payment_status = 'paid'
            AND fulfillment_status NOT IN ('cancelled', 'returned') THEN total ELSE 0 END), 0) AS sales,
          COALESCE(SUM(CASE WHEN fulfillment_status NOT IN ('cancelled', 'returned') THEN total ELSE 0 END), 0) AS placedValue,
          COUNT(*) AS orderCount,
          SUM(CASE WHEN payment_status = 'paid' AND fulfillment_status NOT IN ('cancelled', 'returned') THEN 1 ELSE 0 END) AS paidOrders,
          SUM(CASE WHEN fulfillment_status = 'pending' THEN 1 ELSE 0 END) AS awaitingAction,
          SUM(CASE WHEN fulfillment_status IN ('shipped', 'out-for-delivery') THEN 1 ELSE 0 END) AS onDelivery,
          SUM(CASE WHEN fulfillment_status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
          SUM(CASE WHEN fulfillment_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
          COALESCE(AVG(CASE WHEN payment_status = 'paid'
            AND fulfillment_status NOT IN ('cancelled', 'returned') THEN total END), 0) AS averageOrderValue
        FROM orders WHERE datetime(created_at) >= datetime(?)`,
      )
      .bind(start)
      .first<{
        sales: number
        placedValue: number
        orderCount: number
        paidOrders: number
        awaitingAction: number
        onDelivery: number
        delivered: number
        cancelled: number
        averageOrderValue: number
      }>(),
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
        `SELECT source, COUNT(*) AS orders,
          COALESCE(SUM(CASE WHEN payment_status = 'paid' AND fulfillment_status NOT IN ('cancelled', 'returned') THEN total ELSE 0 END), 0) AS paidValue
        FROM orders WHERE datetime(created_at) >= datetime(?)
        GROUP BY source ORDER BY orders DESC, source`,
      )
      .bind(start)
      .all<{ source: string; orders: number; paidValue: number }>(),
    database
      .prepare(
        `SELECT v.id, p.name_en AS productName, v.sku, v.size, v.color, v.stock
        FROM inventory_variants v JOIN products p ON p.id = v.product_id
        WHERE v.active = 1 AND p.active = 1 AND v.stock <= ?
        ORDER BY v.stock, p.name_en, v.size LIMIT 5`,
      )
      .bind(lowStockThreshold)
      .all<DashboardLowStockItem>(),
    database
      .prepare(
        `SELECT COUNT(*) AS value FROM inventory_variants v JOIN products p ON p.id = v.product_id
        WHERE v.active = 1 AND p.active = 1 AND v.stock <= ?`,
      )
      .bind(lowStockThreshold)
      .first<{ value: number }>(),
    getAbandonedCartMetrics(database, rangeStart(range, now)),
    listAbandonedCarts(database, start),
  ])

  const commerceValues = {
    sales: Number(commerce?.sales || 0),
    placedValue: Number(commerce?.placedValue || 0),
    orders: Number(commerce?.orderCount || 0),
    paidOrders: Number(commerce?.paidOrders || 0),
    averageOrderValue: Math.round(Number(commerce?.averageOrderValue || 0)),
    itemsSold: Number(itemsSold?.value || 0),
    awaitingAction: Number(commerce?.awaitingAction || 0),
    onDelivery: Number(commerce?.onDelivery || 0),
    delivered: Number(commerce?.delivered || 0),
    cancelled: Number(commerce?.cancelled || 0),
    lowStock: Number(lowStockCount?.value || 0),
  }
  snapshot.metrics = snapshot.metrics.map((metric) => {
    if (metric.key in commerceValues) {
      return {
        ...metric,
        value: commerceValues[metric.key as keyof typeof commerceValues],
        availability: 'available' as const,
        note:
          (
            {
              sales: 'قيمة الطلبات المدفوعة حاليًا، شاملة الشحن وحسب تاريخ إنشاء الطلب.',
              placedValue: 'قيمة الطلبات غير الملغاة وغير المرتجعة، ولو لم تُدفع بعد.',
              orders: 'كل الطلبات المسجلة خلال الفترة، بما فيها الملغاة.',
              paidOrders: 'دُفعت ولم تُلغَ أو تُرجع.',
              averageOrderValue: 'المبالغ المحصّلة ÷ عدد الطلبات المدفوعة.',
              itemsSold: 'عدد القطع في الطلبات المدفوعة.',
              awaitingAction: 'طلبات حالتها في انتظار التأكيد.',
              onDelivery: 'تم شحنها أو خرجت للتوصيل.',
              delivered: 'طلبات حالتها تم التسليم.',
              cancelled: 'طلبات حالتها ملغاة.',
              lowStock: `مقاسات نشطة متبقي منها ${lowStockThreshold} قطع أو أقل؛ عدد كل المقاسات، لا أول خمسة فقط.`,
            } as Partial<Record<DashboardMetric['key'], string>>
          )[metric.key] || '',
      }
    }
    if (metric.key === 'abandonedCarts') {
      return {
        ...metric,
        value: recoveryMetrics.abandonedCount,
        availability: 'available' as const,
        note: 'سلات بلا نشاط لمدة ٥ دقائق على الأقل.',
      }
    }
    if (metric.key === 'recoveredCarts') {
      return {
        ...metric,
        value: recoveryMetrics.recoveredCount,
        availability: 'available' as const,
        note: 'سلات تحولت إلى طلبات.',
      }
    }
    if (metric.key === 'recoveredRevenue') {
      return {
        ...metric,
        value: recoveryMetrics.recoveredRevenue,
        availability: 'available' as const,
        note: 'قيمة الطلبات المنسوبة إلى سلات مستعادة.',
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
    'قيمة الطلبات المدفوعة حسب تاريخ إنشاء الطلب.',
    'لا توجد طلبات مدفوعة خلال الفترة.',
  )
  snapshot.recentOrders = section(
    recentOrders.results || [],
    'آخر الطلبات خلال الفترة.',
    'لا توجد طلبات خلال الفترة.',
  )
  snapshot.topProducts = section(
    (topProducts.results || []).map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      revenue: Number(item.revenue),
    })),
    'المنتجات مرتبة حسب عدد القطع المدفوعة.',
    'لا توجد قطع في طلبات مدفوعة خلال الفترة.',
  )
  snapshot.sourcePerformance = section(
    (sourcePerformance.results || []).map((item) => ({
      source: item.source,
      orders: Number(item.orders),
      paidValue: Number(item.paidValue),
    })),
    'عدد الطلبات وقيمة المدفوع حسب المصدر المسجل.',
    'لا توجد طلبات خلال الفترة.',
  )
  snapshot.lowStock = section(
    lowStock.results || [],
    'مقاسات نشطة تحتاج متابعة.',
    'لا توجد مقاسات قليلة المخزون.',
  )
  snapshot.abandonedCarts = {
    availability: carts.length ? 'available' : 'empty',
    message: carts.length ? 'أحدث السلات المتروكة.' : 'لا توجد سلات متروكة في العرض الحالي.',
    items: carts.slice(0, 5),
  }
  const trend = salesTrend.results || []
  const paidDays = trend.filter((day) => Number(day.sales) > 0).length
  const paidOrders = commerceValues.paidOrders
  const enoughForForecast = range !== 'today' && paidOrders >= 3 && paidDays >= 3
  const windowDays = range === '30d' ? 30 : 7
  snapshot.forecast = {
    value: enoughForForecast ? Math.round((commerceValues.sales / windowDays) * 7) : null,
    sampleOrders: paidOrders,
    method: enoughForForecast
      ? `تقدير ٧ أيام قادمة = متوسط قيمة الطلبات المدفوعة حسب تاريخ إنشائها خلال آخر ${windowDays === 7 ? '٧' : '٣٠'} يومًا × ٧. مبني على ${paidOrders} طلبات، وليس ضمانًا للمبيعات.`
      : 'يظهر التقدير بعد ٣ طلبات مدفوعة على ٣ أيام مختلفة خلال ٧ أو ٣٠ يومًا. لا يُحسب لفترة اليوم.',
  }
  const priorities: DashboardSnapshot['priorities'] = []
  if (commerceValues.awaitingAction > 0)
    priorities.push({
      key: 'pending',
      title: 'راجع الطلبات الجديدة',
      detail: 'طلبات ما زالت في انتظار التأكيد.',
      count: commerceValues.awaitingAction,
      to: '/admin/orders?status=pending',
    })
  if (commerceValues.onDelivery > 0)
    priorities.push({
      key: 'delivery',
      title: 'تابع الطلبات مع شركة الشحن',
      detail: 'طلبات تم شحنها أو خرجت للتوصيل خلال الفترة.',
      count: commerceValues.onDelivery,
      to: '/admin/orders',
    })
  if (commerceValues.lowStock > 0)
    priorities.push({
      key: 'stock',
      title: 'راجع المخزون',
      detail: `مقاسات وصل رصيدها إلى ${lowStockThreshold} قطع أو أقل.`,
      count: commerceValues.lowStock,
      to: '/admin/inventory',
    })
  if (recoveryMetrics.abandonedCount > 0)
    priorities.push({
      key: 'carts',
      title: 'تابع السلات المتروكة',
      detail: 'عملاء لم يكملوا الشراء بعد فترة عدم نشاط.',
      count: recoveryMetrics.abandonedCount,
      to: '/admin/abandoned-carts',
    })
  snapshot.priorities = priorities
  return snapshot
}
