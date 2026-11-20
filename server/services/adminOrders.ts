import type {
  AdminOrderCapabilities,
  AdminOrderDetailResponse,
  AdminOrderListResponse,
  OrderFulfillmentStatus,
  OrderEvent,
  AdminOrderFilters,
  AdminOrderInventoryRow,
} from '../../shared/adminOrder'
import { ORDER_FULFILLMENT_STATUSES as fulfillmentStatuses } from '../../shared/adminOrder.ts'
import type { AdminOrderDetail, AdminOrderLine, AdminOrderSummary } from '../../shared/adminOrder'
import type { D1Database } from '../utils/d1'
import { allowedFulfillmentTransitions } from './orderTransitions.ts'
import { sanitizeCampaignAttribution } from '../../shared/campaignAttribution.ts'

type AdminOrderRow = Omit<
  AdminOrderDetail,
  | 'lines'
  | 'events'
  | 'allowedFulfillmentTransitions'
  | 'canRestockReturned'
  | 'canDelete'
  | 'deleteBlockReason'
  | 'attribution'
> & {
  inventoryRestoredAt?: string | null
  returnedRestockedAt?: string | null
  campaignAttributionJson?: string | null
}

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
  search: true,
  statusFilter: true,
  statusTransitions: true,
}

const pageSize = 25

function emptyStatusCounts(): Record<OrderFulfillmentStatus, number> {
  return Object.fromEntries(fulfillmentStatuses.map((status) => [status, 0])) as Record<
    OrderFulfillmentStatus,
    number
  >
}

export async function listAdminOrders(
  database?: D1Database,
  filters: AdminOrderFilters = {},
): Promise<AdminOrderListResponse> {
  if (database) {
    const status =
      filters.status && fulfillmentStatuses.includes(filters.status) ? filters.status : undefined
    const q = filters.q?.trim().slice(0, 80) || ''
    const page = Math.max(1, Math.min(10000, Math.trunc(filters.page || 1)))
    const conditions: string[] = []
    const values: unknown[] = []
    if (status) {
      conditions.push('o.fulfillment_status = ?')
      values.push(status)
    }
    if (q) {
      conditions.push('(o.number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)')
      const search = `%${q}%`
      values.push(search, search, search)
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const [countResult, statusResult, inventoryResult] = await Promise.all([
      database
        .prepare(
          `SELECT COUNT(*) AS total FROM orders o JOIN customers c ON c.id = o.customer_id ${where}`,
        )
        .bind(...values)
        .first<{ total: number }>(),
      database
        .prepare(
          'SELECT fulfillment_status AS status, COUNT(*) AS count FROM orders GROUP BY fulfillment_status',
        )
        .all<{ status: OrderFulfillmentStatus; count: number }>(),
      database
        .prepare(
          `SELECT v.id, v.product_name AS productName, p.category,
        v.size, v.color, v.stock,
        COALESCE(SUM(CASE WHEN o.fulfillment_status = 'pending' THEN oi.quantity ELSE 0 END), 0) AS pendingQuantity,
        COALESCE(SUM(CASE WHEN o.fulfillment_status IN ('pending','confirmed','processing','shipped','out-for-delivery')
          THEN oi.quantity ELSE 0 END), 0) AS openQuantity
        FROM inventory_variants v JOIN products p ON p.id = v.product_id
        LEFT JOIN order_items oi ON oi.variant_id = v.id
        LEFT JOIN orders o ON o.id = oi.order_id
        GROUP BY v.id
        HAVING v.active = 1 OR openQuantity > 0
        ORDER BY p.category, p.name_en, v.size, v.color`,
        )
        .all<AdminOrderInventoryRow>(),
    ])
    const statusCounts = emptyStatusCounts()
    for (const row of statusResult.results || []) {
      if (row.status in statusCounts) statusCounts[row.status] = row.count
    }
    const result = await database
      .prepare(
        `SELECT o.id, o.number, c.name AS customerName,
      c.phone AS customerPhone, o.total, o.payment_method AS paymentMethod,
      o.payment_status AS paymentStatus, o.fulfillment_status AS fulfillmentStatus,
      o.source, o.created_at AS createdAt,
      o.inventory_restored_at AS inventoryRestoredAt,
      o.returned_restocked_at AS returnedRestockedAt
      FROM orders o JOIN customers c ON c.id = o.customer_id
      ${where} ORDER BY o.created_at DESC, o.rowid DESC LIMIT ? OFFSET ?`,
      )
      .bind(...values, pageSize, (page - 1) * pageSize)
      .all<AdminOrderListRow>()
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
    return {
      availability: Object.values(statusCounts).some(Boolean) ? 'available' : 'empty',
      message: '',
      capabilities,
      items,
      total: countResult?.total || 0,
      page,
      pageSize,
      statusCounts,
      inventory: inventoryResult.results || [],
    }
  }
  return {
    availability: 'unavailable',
    message:
      'Persistent orders are not enabled. Demo order previews remain in the customer tab only.',
    capabilities: unavailableCapabilities,
    items: [],
    total: 0,
    page: 1,
    pageSize,
    statusCounts: emptyStatusCounts(),
    inventory: [],
  }
}

export async function getAdminOrder(
  id: string,
  database?: D1Database,
): Promise<AdminOrderDetailResponse> {
  if (database) {
    const order = await database
      .prepare(
        `SELECT o.id, o.number, c.name AS customerName,
      c.phone AS customerPhone, c.email AS customerEmail,
      c.address || ', ' || c.city || ', ' || c.governorate AS address,
      o.subtotal, o.shipping, o.discount, o.discount_code AS discountCode, o.total, o.payment_method AS paymentMethod,
      o.payment_status AS paymentStatus, o.fulfillment_status AS fulfillmentStatus,
      o.source, o.notes, o.created_at AS createdAt,
      o.public_reference AS publicReference,
      o.campaign_attribution AS campaignAttributionJson,
      (SELECT state FROM meta_event_outbox WHERE event_name='Purchase'
        AND event_id=o.public_reference) AS metaDeliveryStatus,
      (SELECT state FROM ga4_purchase_outbox WHERE transaction_id=o.public_reference)
        AS ga4DeliveryStatus,
      o.inventory_restored_at AS inventoryRestoredAt,
      o.returned_restocked_at AS returnedRestockedAt
      FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`,
      )
      .bind(id)
      .first<AdminOrderRow>()
    if (!order)
      return { availability: 'not-found', message: 'Order not found.', capabilities, order: null }
    const lines = await database
      .prepare(
        `SELECT id, product_name AS productName, variant,
      quantity, unit_price AS unitPrice, total FROM order_items WHERE order_id = ? ORDER BY rowid`,
      )
      .bind(id)
      .all<AdminOrderLine>()
    const events = await database
      .prepare(
        `SELECT id, event_type AS eventType,
      from_value AS fromValue, to_value AS toValue, note, actor_email AS actorEmail,
      created_at AS createdAt FROM order_events WHERE order_id = ?
      ORDER BY created_at DESC, rowid DESC`,
      )
      .bind(id)
      .all<OrderEvent>()
    const { inventoryRestoredAt, returnedRestockedAt, campaignAttributionJson, ...details } = order
    let attribution = null
    try {
      if (campaignAttributionJson)
        attribution = sanitizeCampaignAttribution(JSON.parse(campaignAttributionJson))
    } catch {
      // Older malformed attribution must not hide the order.
    }
    return {
      availability: 'available',
      message: '',
      capabilities,
      order: {
        ...details,
        attribution,
        lines: lines.results || [],
        events: events.results || [],
        allowedFulfillmentTransitions: allowedFulfillmentTransitions(details.fulfillmentStatus),
        canRestockReturned: details.fulfillmentStatus === 'returned' && !returnedRestockedAt,
        ...orderDeletionState({
          fulfillmentStatus: details.fulfillmentStatus,
          inventoryRestoredAt,
          returnedRestockedAt,
        }),
      },
    }
  }
  return {
    availability: 'unavailable',
    message: 'Order details require a persistent order repository.',
    capabilities: unavailableCapabilities,
    order: null,
  }
}

export async function deleteAdminOrder(database: D1Database, id: string, expectedNumber: string) {
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
