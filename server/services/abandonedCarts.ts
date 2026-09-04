import type {
  AbandonedCartDetail,
  AbandonedCartItem,
  AbandonedCartSummary,
  CartRecoveryState,
  CartSnapshotInput,
} from '../../shared/abandonedCart'
import { assertAvailableStock, groupOrderLines } from '../../shared/order.ts'
import type { D1Database } from '../utils/d1'

export const abandonmentMinutes = 30

type CartRow = Omit<AbandonedCartSummary, 'recoveryState'> & {
  recoveryState: CartRecoveryState
}

export async function saveCartSnapshot(database: D1Database, input: CartSnapshotInput) {
  if (!input?.cartId?.match(/^[a-f0-9-]{20,80}$/i)) throw new Error('Invalid cart identifier.')
  if (!Array.isArray(input.items)) throw new Error('Invalid cart contents.')
  const now = new Date().toISOString()
  if (!input.items.length) {
    await database.batch([
      database.prepare(`INSERT INTO abandoned_carts
        (id, subtotal, items_count, state, created_at, last_activity)
        VALUES (?, 0, 0, 'cleared', ?, ?)
        ON CONFLICT(id) DO UPDATE SET subtotal = 0, items_count = 0,
        state = 'cleared', last_activity = excluded.last_activity`).bind(input.cartId, now, now),
      database.prepare('DELETE FROM abandoned_cart_items WHERE cart_id = ?').bind(input.cartId),
    ])
    return { tracked: true }
  }

  const grouped = groupOrderLines(input.items.map((item) => ({
    key: `${item.id}:${item.size}`,
    quantity: item.quantity,
  })))
  const variants = await database.prepare(`SELECT v.id, v.product_id AS productId,
    v.size, v.color, v.stock, v.unit_price AS unitPrice, p.name_en AS productName, p.image
    FROM inventory_variants v JOIN products p ON p.id = v.product_id
    JOIN categories c ON c.slug = p.category
    WHERE v.active = 1 AND p.active = 1 AND c.active = 1`).all<{
      id: string
      productId: string
      size: string
      color: string
      stock: number
      unitPrice: number
      productName: string
      image: string
    }>()
  const lines = [...grouped].map(([key, quantity]) => {
    const [productId, size] = key.split(':')
    const variant = (variants.results || []).find((item) => item.productId === productId && item.size === size)
    if (!variant) throw new Error('A cart variant is unavailable.')
    assertAvailableStock(quantity, variant.stock)
    return { ...variant, quantity, total: variant.unitPrice * quantity }
  })
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0)
  const itemsCount = lines.reduce((sum, line) => sum + line.quantity, 0)
  await database.batch([
    database.prepare(`INSERT INTO abandoned_carts
      (id, subtotal, items_count, state, created_at, last_activity)
      VALUES (?, ?, ?, 'active', ?, ?)
      ON CONFLICT(id) DO UPDATE SET subtotal = excluded.subtotal,
      items_count = excluded.items_count, state = 'active', last_activity = excluded.last_activity`)
      .bind(input.cartId, subtotal, itemsCount, now, now),
    database.prepare('DELETE FROM abandoned_cart_items WHERE cart_id = ?').bind(input.cartId),
    ...lines.map((line) => database.prepare(`INSERT INTO abandoned_cart_items
      (id, cart_id, product_id, variant_id, product_name, variant, image, quantity, unit_price, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), input.cartId,
        line.productId, line.id, line.productName, `${line.color} / ${line.size}`, line.image,
        line.quantity, line.unitPrice, line.total)),
  ])
  return { tracked: true }
}

const recoveryExpression = `CASE
  WHEN state = 'converted' THEN 'recovered'
  WHEN phone IS NOT NULL OR email IS NOT NULL THEN 'not-started'
  ELSE 'unavailable' END`

export async function listAbandonedCarts(database: D1Database) {
  const result = await database.prepare(`SELECT id, customer_name AS customerName, phone, email,
    subtotal, items_count AS itemsCount, last_activity AS lastActivity, created_at AS createdAt,
    ${recoveryExpression} AS recoveryState FROM abandoned_carts
    WHERE state = 'active' AND datetime(last_activity) <= datetime('now', '-${abandonmentMinutes} minutes')
    ORDER BY last_activity DESC LIMIT 100`).all<CartRow>()
  return result.results || []
}

export async function getAbandonedCart(database: D1Database, id: string): Promise<AbandonedCartDetail | null> {
  const cart = await database.prepare(`SELECT id, customer_name AS customerName, phone, email,
    subtotal, items_count AS itemsCount, last_activity AS lastActivity, created_at AS createdAt,
    ${recoveryExpression} AS recoveryState FROM abandoned_carts WHERE id = ?`).bind(id).first<CartRow>()
  if (!cart) return null
  const items = await database.prepare(`SELECT id, product_id AS productId, product_name AS productName,
    variant, image, quantity, unit_price AS unitPrice, total
    FROM abandoned_cart_items WHERE cart_id = ? ORDER BY rowid`).bind(id).all<AbandonedCartItem>()
  return { ...cart, items: items.results || [] }
}

export async function getAbandonedCartMetrics(database: D1Database, since?: string) {
  const row = await database.prepare(`SELECT
    COUNT(CASE WHEN state = 'active' AND datetime(last_activity) <= datetime('now', '-${abandonmentMinutes} minutes') THEN 1 END) AS abandonedCount,
    COUNT(CASE WHEN state = 'converted' THEN 1 END) AS recoveredCount,
    COALESCE(SUM(CASE WHEN state = 'converted' THEN subtotal ELSE 0 END), 0) AS recoveredRevenue
    FROM abandoned_carts WHERE (? IS NULL OR datetime(created_at) >= datetime(?))`)
    .bind(since || null, since || null).first<{ abandonedCount: number; recoveredCount: number; recoveredRevenue: number }>()
  return {
    abandonedCount: Number(row?.abandonedCount || 0),
    recoveredCount: Number(row?.recoveredCount || 0),
    recoveredRevenue: Number(row?.recoveredRevenue || 0),
  }
}