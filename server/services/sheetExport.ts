import type { D1Database } from '../utils/d1.ts'

interface OrderRow {
  exportCursor: number
  id: string
  number: string
  createdAt: string
  source: string
  paymentStatus: string
  orderStatus: string
  subtotal: number
  discount: number
  shipping: number
  total: number
  returnedRestockedAt: string | null
}

interface ItemRow {
  lineId: string
  orderId: string
  productName: string
  sku: string
  variant: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface SheetOrderLine extends Omit<OrderRow, 'exportCursor' | 'id'>, Omit<ItemRow, 'orderId'> {}

export interface SheetInventoryRow {
  sku: string
  productName: string
  productSlug: string
  size: string
  color: string
  stock: number
  unitPrice: number
  active: number
  updatedAt: string
}

export async function verifySheetSyncToken(provided: string, configured: string) {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(provided) || !/^[A-Za-z0-9_-]{43,128}$/.test(configured))
    return false
  const encoder = new TextEncoder()
  const [actual, expected] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(configured)),
  ])
  const left = new Uint8Array(actual)
  const right = new Uint8Array(expected)
  let difference = 0
  for (let index = 0; index < left.length; index++) difference |= left[index]! ^ right[index]!
  return difference === 0
}

export async function getSheetExportPage(database: D1Database, cursor = 0, limit = 100) {
  if (!Number.isSafeInteger(cursor) || cursor < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new Error('Invalid export page.')

  const orders = await database.prepare(`SELECT rowid AS exportCursor, id, number,
    created_at AS createdAt, source, payment_status AS paymentStatus,
    fulfillment_status AS orderStatus, subtotal, discount, shipping, total,
    returned_restocked_at AS returnedRestockedAt
    FROM orders WHERE rowid > ? ORDER BY rowid LIMIT ?`).bind(cursor, limit).all<OrderRow>()
  const orderRows = orders.results || []
  const items = orderRows.length
    ? await database.prepare(`SELECT id AS lineId, order_id AS orderId,
        product_name AS productName, sku, variant, quantity,
        unit_price AS unitPrice, total AS lineTotal
        FROM order_items WHERE order_id IN (${orderRows.map(() => '?').join(',')}) ORDER BY rowid`)
      .bind(...orderRows.map((order) => order.id)).all<ItemRow>()
    : { results: [] as ItemRow[] }
  const byOrder = new Map<string, ItemRow[]>()
  for (const item of items.results || []) {
    const lines = byOrder.get(item.orderId) || []
    lines.push(item)
    byOrder.set(item.orderId, lines)
  }
  const lines: SheetOrderLine[] = orderRows.flatMap(({ exportCursor: _cursor, id, ...order }) =>
    (byOrder.get(id) || []).map(({ orderId: _orderId, ...item }) => ({ ...order, ...item })))

  const inventory = cursor === 0
    ? await database.prepare(`SELECT v.sku, p.name_en AS productName,
        p.slug AS productSlug, v.size, v.color, v.stock,
        v.unit_price AS unitPrice, v.active, v.updated_at AS updatedAt
        FROM inventory_variants v JOIN products p ON p.id = v.product_id
        ORDER BY p.name_en, v.size`).all<SheetInventoryRow>()
    : { results: [] as SheetInventoryRow[] }

  return {
    orders: lines,
    inventory: inventory.results || [],
    nextCursor: orderRows.length === limit ? orderRows.at(-1)!.exportCursor : null,
  }
}
