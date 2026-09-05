import type {
  AdminOrderCapabilities,
  AdminOrderDetailResponse,
  AdminOrderListResponse,
  OrderEvent,
} from '../../shared/adminOrder'
import type { AdminOrderDetail, AdminOrderLine, AdminOrderSummary } from '../../shared/adminOrder'
import type { D1Database } from '../utils/d1'
import { allowedFulfillmentTransitions } from './orderTransitions.ts'

type AdminOrderRow = Omit<
  AdminOrderDetail,
  'lines' | 'events' | 'allowedFulfillmentTransitions' | 'canRestockReturned'
> & { returnedRestockedAt?: string }

const unavailableCapabilities: AdminOrderCapabilities = {
  search: false,
  statusFilter: false,
  paymentMethodFilter: false,
  sourceFilter: false,
  dateFilter: false,
  statusTransitions: false,
}

const capabilities: AdminOrderCapabilities = {
  ...unavailableCapabilities,
  statusTransitions: true,
}

export async function listAdminOrders(database?: D1Database): Promise<AdminOrderListResponse> {
  if (database) {
    const result = await database.prepare(`SELECT o.id, o.number, c.name AS customerName,
      c.phone AS customerPhone, o.total, o.payment_method AS paymentMethod,
      o.payment_status AS paymentStatus, o.fulfillment_status AS fulfillmentStatus,
      o.source, o.created_at AS createdAt
      FROM orders o JOIN customers c ON c.id = o.customer_id
      ORDER BY o.created_at DESC LIMIT 100`).all<AdminOrderSummary>()
    const items = result.results || []
    return { availability: items.length ? 'available' : 'empty', message: '', capabilities,
      items, total: items.length }
  }
  return {
    availability: 'unavailable',
    message: 'Persistent orders are not enabled. Demo order previews remain in the customer tab only.',
    capabilities: unavailableCapabilities,
    items: [],
    total: 0,
  }
}

export async function getAdminOrder(id: string, database?: D1Database): Promise<AdminOrderDetailResponse> {
  if (database) {
    const order = await database.prepare(`SELECT o.id, o.number, c.name AS customerName,
      c.phone AS customerPhone, c.email AS customerEmail,
      c.address || ', ' || c.city || ', ' || c.governorate AS address,
      o.subtotal, o.shipping, o.discount, o.discount_code AS discountCode, o.total, o.payment_method AS paymentMethod,
      o.payment_status AS paymentStatus, o.fulfillment_status AS fulfillmentStatus,
      o.source, o.notes, o.created_at AS createdAt,
      o.returned_restocked_at AS returnedRestockedAt
      FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`)
      .bind(id).first<AdminOrderRow>()
    if (!order) return { availability: 'not-found', message: 'Order not found.', capabilities, order: null }
    const lines = await database.prepare(`SELECT id, product_name AS productName, variant,
      quantity, unit_price AS unitPrice, total FROM order_items WHERE order_id = ? ORDER BY rowid`)
      .bind(id).all<AdminOrderLine>()
    const events = await database.prepare(`SELECT id, event_type AS eventType,
      from_value AS fromValue, to_value AS toValue, note, actor_email AS actorEmail,
      created_at AS createdAt FROM order_events WHERE order_id = ?
      ORDER BY created_at DESC, rowid DESC`)
      .bind(id).all<OrderEvent>()
    const { returnedRestockedAt, ...details } = order
    return { availability: 'available', message: '', capabilities,
      order: {
        ...details,
        lines: lines.results || [],
        events: events.results || [],
        allowedFulfillmentTransitions: allowedFulfillmentTransitions(details.fulfillmentStatus),
        canRestockReturned:
          details.fulfillmentStatus === 'returned' && !returnedRestockedAt,
      } }
  }
  return {
    availability: 'unavailable',
    message: 'Order details require a persistent order repository.',
    capabilities: unavailableCapabilities,
    order: null,
  }
}
