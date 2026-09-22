import type {
  AdminOrderCapabilities,
  AdminOrderDetailResponse,
  AdminOrderListResponse,
  OrderFulfillmentStatus,
  OrderEvent,
} from '../../shared/adminOrder'
import type { AdminOrderDetail, AdminOrderLine, AdminOrderSummary } from '../../shared/adminOrder'
import type { D1Database } from '../utils/d1'
import { allowedFulfillmentTransitions } from './orderTransitions.ts'

type AdminOrderRow = Omit<
  AdminOrderDetail,
  | 'lines'
  | 'events'
  | 'allowedFulfillmentTransitions'
  | 'canRestockReturned'
  | 'canDelete'
  | 'deleteBlockReason'
> & { inventoryRestoredAt?: string | null; returnedRestockedAt?: string | null }

type AdminOrderListRow = Omit<AdminOrderSummary, 'canDelete' | 'deleteBlockReason'> & {
  inventoryRestoredAt?: string | null
  returnedRestockedAt?: string | null
}

type OrderDeletionRow = {
  number: string
  fulfillmentStatus: OrderFulfillmentStatus
  inventoryRestoredAt?: string | null
  returnedRestockedAt?: string | null
}

function orderDeletionState(row: {
  fulfillmentStatus: OrderFulfillmentStatus
  inventoryRestoredAt?: string | null
  returnedRestockedAt?: string | null
}) {
  if (row.fulfillmentStatus === 'delivered') return { canDelete: true, deleteBlockReason: '' }
  if (row.fulfillmentStatus === 'cancelled') {
    return row.inventoryRestoredAt
      ? { canDelete: true, deleteBlockReason: '' }
      : {
          canDelete: false,
          deleteBlockReason: 'Cancel inventory restoration must finish before deletion.',
        }
  }
  if (row.fulfillmentStatus === 'returned') {
    return row.returnedRestockedAt
      ? { canDelete: true, deleteBlockReason: '' }
      : {
          canDelete: false,
          deleteBlockReason: 'Restock inspected returned items before deletion.',
        }
  }
  if (['pending', 'confirmed', 'processing'].includes(row.fulfillmentStatus)) {
    return { canDelete: false, deleteBlockReason: 'Cancel this order before deleting it.' }
  }
  return {
    canDelete: false,
    deleteBlockReason: 'Finish the active delivery before deleting it.',
  }
}

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
      o.source, o.created_at AS createdAt,
      o.inventory_restored_at AS inventoryRestoredAt,
      o.returned_restocked_at AS returnedRestockedAt
      FROM orders o JOIN customers c ON c.id = o.customer_id
      ORDER BY o.created_at DESC LIMIT 100`).all<AdminOrderListRow>()
    const items = (result.results || []).map(
      ({ inventoryRestoredAt, returnedRestockedAt, ...item }) => ({
        ...item,
        ...orderDeletionState({
          fulfillmentStatus: item.fulfillmentStatus,
          inventoryRestoredAt,
          returnedRestockedAt,
        }),
      }),
    )
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
      o.inventory_restored_at AS inventoryRestoredAt,
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
    const { inventoryRestoredAt, returnedRestockedAt, ...details } = order
    return { availability: 'available', message: '', capabilities,
      order: {
        ...details,
        lines: lines.results || [],
        events: events.results || [],
        allowedFulfillmentTransitions: allowedFulfillmentTransitions(details.fulfillmentStatus),
        canRestockReturned:
          details.fulfillmentStatus === 'returned' && !returnedRestockedAt,
        ...orderDeletionState({
          fulfillmentStatus: details.fulfillmentStatus,
          inventoryRestoredAt,
          returnedRestockedAt,
        }),
      } }
  }
  return {
    availability: 'unavailable',
    message: 'Order details require a persistent order repository.',
    capabilities: unavailableCapabilities,
    order: null,
  }
}

export async function deleteAdminOrder(
  database: D1Database,
  id: string,
  expectedNumber: string,
) {
  const cleanId = id.trim()
  const cleanNumber = expectedNumber.trim()
  if (!cleanId || !cleanNumber) throw new Error('ORDER_DELETE_INVALID')
  const current = await database
    .prepare(
      `SELECT number, fulfillment_status AS fulfillmentStatus,
      inventory_restored_at AS inventoryRestoredAt,
      returned_restocked_at AS returnedRestockedAt
      FROM orders WHERE id = ?`,
    )
    .bind(cleanId)
    .first<OrderDeletionRow>()
  if (!current) throw new Error('ORDER_NOT_FOUND')
  if (current.number !== cleanNumber || !orderDeletionState(current).canDelete) {
    throw new Error('ORDER_DELETE_CONFLICT')
  }

  const eligible = `((fulfillment_status = 'cancelled' AND inventory_restored_at IS NOT NULL)
    OR fulfillment_status = 'delivered'
    OR (fulfillment_status = 'returned' AND returned_restocked_at IS NOT NULL))`
  const results = await database.batch([
    database
      .prepare(
        `UPDATE abandoned_carts SET recovered_order_id = NULL
        WHERE recovered_order_id = ? AND EXISTS (
          SELECT 1 FROM orders WHERE id = ? AND number = ? AND ${eligible}
        )`,
      )
      .bind(cleanId, cleanId, cleanNumber),
    database
      .prepare(`DELETE FROM orders WHERE id = ? AND number = ? AND ${eligible}`)
      .bind(cleanId, cleanNumber),
  ])
  if ((results[1]?.meta?.changes || 0) !== 1) throw new Error('ORDER_DELETE_CONFLICT')
  return { deleted: true as const, id: cleanId }
}
