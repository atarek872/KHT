import type { D1Database } from '../utils/d1'
import type {
  AdminOrderLine,
  OrderFulfillmentStatus,
  OrderPaymentMethod,
  OrderPaymentStatus,
} from '../../shared/adminOrder'

export interface CustomerOrderSummary {
  id: string
  number: string
  total: number
  createdAt: string
  fulfillmentStatus: OrderFulfillmentStatus
  paymentStatus: OrderPaymentStatus
  paymentMethod: OrderPaymentMethod
}
export interface CustomerOrderDetail extends CustomerOrderSummary {
  customerName: string
  customerPhone: string
  customerEmail: string | null
  address: string
  subtotal: number
  shipping: number
  discount: number
  trackingNumber: string | null
  trackingCarrier: string | null
  lines: AdminOrderLine[]
  history: { status: OrderFulfillmentStatus; createdAt: string }[]
}
export async function listCustomerOrders(database: D1Database, userId: string, page = 1) {
  const boundedPage = Number.isFinite(page) ? Math.max(1, Math.min(10000, Math.floor(page))) : 1
  const result = await database
    .prepare(
      `SELECT id,number,total,created_at AS createdAt,
    fulfillment_status AS fulfillmentStatus,payment_status AS paymentStatus,payment_method AS paymentMethod
    FROM orders WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 21 OFFSET ?`,
    )
    .bind(userId, (boundedPage - 1) * 20)
    .all<CustomerOrderSummary>()
  const rows = result.results || []
  return { items: rows.slice(0, 20), hasMore: rows.length > 20 }
}
export async function getCustomerOrder(
  database: D1Database,
  userId: string | null,
  id: string,
  guestHash: string | null = null,
): Promise<CustomerOrderDetail | null> {
  const order = await database
    .prepare(
      `SELECT id,number,total,created_at AS createdAt,
    fulfillment_status AS fulfillmentStatus,payment_status AS paymentStatus,payment_method AS paymentMethod,
    json_extract(shipping_snapshot,'$.name') AS customerName,json_extract(shipping_snapshot,'$.phone') AS customerPhone,
    json_extract(shipping_snapshot,'$.email') AS customerEmail,
    COALESCE(json_extract(shipping_snapshot,'$.address'),'') || ', ' || COALESCE(json_extract(shipping_snapshot,'$.city'),'') || ', ' || COALESCE(json_extract(shipping_snapshot,'$.governorate'),'') AS address,
    subtotal,shipping,discount,tracking_number AS trackingNumber,tracking_carrier AS trackingCarrier
    FROM orders WHERE id=? AND (user_id=? OR (user_id IS NULL AND cart_id IN
      (SELECT id FROM abandoned_carts WHERE guest_key_hash=? AND user_id IS NULL)))`,
    )
    .bind(id, userId, guestHash)
    .first<Omit<CustomerOrderDetail, 'lines' | 'history'>>()
  if (!order) return null
  const [lines, history] = await Promise.all([
    database
      .prepare(
        'SELECT id,product_name AS productName,variant,quantity,unit_price AS unitPrice,total FROM order_items WHERE order_id=? ORDER BY rowid',
      )
      .bind(id)
      .all<AdminOrderLine>(),
    database
      .prepare(
        'SELECT status,created_at AS createdAt FROM order_status_history WHERE order_id=? ORDER BY id',
      )
      .bind(id)
      .all<CustomerOrderDetail['history'][number]>(),
  ])
  return { ...order, lines: lines.results || [], history: history.results || [] }
}
