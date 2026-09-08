import type {
  AdminOrderCapabilities,
  AdminOrderDetailResponse,
  AdminOrderListResponse,
} from '../../shared/adminOrder'
import type {
  AdminOrderDetail,
  AdminOrderLine,
  AdminOrderSummary,
  OrderFulfillmentStatus,
} from '../../shared/adminOrder'
import type { D1Database } from '../utils/d1'

const capabilities: AdminOrderCapabilities = {
  search: false,
  statusFilter: false,
  paymentMethodFilter: false,
  sourceFilter: false,
  dateFilter: false,
  statusTransitions: true,
}

export async function listAdminOrders(database?: D1Database): Promise<AdminOrderListResponse> {
  if (database) {
    const result = await database
      .prepare(
        `SELECT o.id, o.number, c.name AS customerName,
      c.phone AS customerPhone, o.total, o.payment_method AS paymentMethod,
      o.payment_status AS paymentStatus, o.fulfillment_status AS fulfillmentStatus,
      o.source, o.created_at AS createdAt
      FROM orders o JOIN customers c ON c.id = o.customer_id
      ORDER BY o.created_at DESC LIMIT 100`,
      )
      .all<AdminOrderSummary>()
    const items = result.results || []
    return {
      availability: items.length ? 'available' : 'empty',
      message: '',
      capabilities,
      items,
      total: items.length,
    }
  }
  return {
    availability: 'unavailable',
    message:
      'Persistent orders are not enabled. Demo order previews remain in the customer tab only.',
    capabilities,
    items: [],
    total: 0,
  }
}

export async function getAdminOrder(
  id: string,
  database?: D1Database,
): Promise<AdminOrderDetailResponse> {
  if (database) {
    const order = await database
      .prepare(
        `SELECT o.id, o.number,
      COALESCE(json_extract(o.shipping_snapshot,'$.name'),c.name) AS customerName,
      COALESCE(json_extract(o.shipping_snapshot,'$.phone'),c.phone) AS customerPhone,
      COALESCE(json_extract(o.shipping_snapshot,'$.email'),c.email) AS customerEmail,
      COALESCE(json_extract(o.shipping_snapshot,'$.address') || ', ' || json_extract(o.shipping_snapshot,'$.city') || ', ' || json_extract(o.shipping_snapshot,'$.governorate'),
        c.address || ', ' || c.city || ', ' || c.governorate) AS address,
      o.subtotal, o.shipping, o.discount, o.discount_code AS discountCode, o.total, o.payment_method AS paymentMethod,
      o.payment_status AS paymentStatus, o.fulfillment_status AS fulfillmentStatus,
      o.source, o.notes, o.created_at AS createdAt
      FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`,
      )
      .bind(id)
      .first<Omit<AdminOrderDetail, 'lines' | 'allowedFulfillmentTransitions'>>()
    if (!order)
      return { availability: 'not-found', message: 'Order not found.', capabilities, order: null }
    const lines = await database
      .prepare(
        `SELECT id, product_name AS productName, variant,
      quantity, unit_price AS unitPrice, total FROM order_items WHERE order_id = ? ORDER BY rowid`,
      )
      .bind(id)
      .all<AdminOrderLine>()
    return {
      availability: 'available',
      message: '',
      capabilities,
      order: {
        ...order,
        lines: lines.results || [],
        allowedFulfillmentTransitions: fulfillmentTransitions[order.fulfillmentStatus],
      },
    }
  }
  return {
    availability: 'unavailable',
    message: 'Order details require a persistent order repository.',
    capabilities,
    order: null,
  }
}
export const fulfillmentTransitions: Record<OrderFulfillmentStatus, OrderFulfillmentStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['out-for-delivery'],
  'out-for-delivery': ['delivered'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
}
export async function transitionAdminOrder(
  database: D1Database,
  id: string,
  expectedStatus: OrderFulfillmentStatus,
  status: OrderFulfillmentStatus,
  trackingNumber?: string,
  trackingCarrier?: string,
) {
  if (!fulfillmentTransitions[expectedStatus]?.includes(status))
    throw createError({ statusCode: 400, statusMessage: 'Invalid order status transition.' })
  const result = await database
    .prepare(
      `UPDATE orders SET fulfillment_status=?,tracking_number=COALESCE(?,tracking_number),tracking_carrier=COALESCE(?,tracking_carrier) WHERE id=? AND fulfillment_status=?`,
    )
    .bind(status, trackingNumber ?? null, trackingCarrier ?? null, id, expectedStatus)
    .run()
  if (result.meta?.changes !== 1)
    throw createError({ statusCode: 409, statusMessage: 'Order changed. Refresh and try again.' })
  return getAdminOrder(id, database)
}
