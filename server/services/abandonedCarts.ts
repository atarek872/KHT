import type {
  AbandonedCartDetail,
  AbandonedCartItem,
  AbandonedCartSummary,
  CartContactInput,
  CartRecoveryEvent,
  CartRecoveryState,
  CartSnapshotInput,
} from '../../shared/abandonedCart'
import { assertAvailableStock, groupOrderLines } from '../../shared/order.ts'
import type { D1Database } from '../utils/d1'
import { normalizeEgyptianPhone } from './createOrder.ts'

export const abandonmentMinutes = 30

type CartRow = Omit<AbandonedCartSummary, 'recoveryState'> & {
  recoveryState: CartRecoveryState
}

const manualRecoveryTransitions: Record<CartRecoveryState, CartRecoveryState[]> = {
  active: ['contacted', 'dismissed', 'recovered'],
  contacted: ['dismissed', 'recovered'],
  dismissed: [],
  converted: [],
  recovered: [],
}

function normalizeContact(contact?: CartContactInput) {
  if (!contact) return null
  const name = contact.name?.trim() || undefined
  const rawPhone = contact.phone?.trim() || undefined
  const rawEmail = contact.email?.trim() || undefined
  if (name && name.length > 100) throw new Error('Contact name is too long.')
  if (rawPhone && rawPhone.length > 30) throw new Error('Contact phone is too long.')
  if (rawEmail && rawEmail.length > 254) throw new Error('Contact email is too long.')
  const phone = rawPhone ? normalizeEgyptianPhone(rawPhone) : undefined
  const email = rawEmail?.toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address.')
  }
  if (!phone && !email) throw new Error('Enter a valid phone or email before saving contact.')
  return { name, phone, email }
}

export async function saveCartSnapshot(database: D1Database, input: CartSnapshotInput) {
  if (!input?.cartId?.match(/^[a-f0-9-]{20,80}$/i)) throw new Error('Invalid cart identifier.')
  if (!Array.isArray(input.items)) throw new Error('Invalid cart contents.')
  const now = new Date().toISOString()
  const contact = normalizeContact(input.contact)
  if (!input.items.length) {
    await database.batch([
      database
        .prepare(
          `INSERT INTO abandoned_carts
        (id, subtotal, items_count, state, created_at, last_activity)
        VALUES (?, 0, 0, 'cleared', ?, ?)
        ON CONFLICT(id) DO UPDATE SET subtotal = 0, items_count = 0,
        state = 'cleared', last_activity = excluded.last_activity`,
        )
        .bind(input.cartId, now, now),
      database.prepare('DELETE FROM abandoned_cart_items WHERE cart_id = ?').bind(input.cartId),
    ])
    return { tracked: true }
  }

  const grouped = groupOrderLines(
    input.items.map((item) => ({
      key: `${item.id}:${item.size}`,
      quantity: item.quantity,
    })),
  )
  const variants = await database
    .prepare(
      `SELECT v.id, v.product_id AS productId,
    v.size, v.color, v.stock, v.unit_price AS unitPrice, p.name_en AS productName, p.image
    FROM inventory_variants v JOIN products p ON p.id = v.product_id
    JOIN categories c ON c.slug = p.category
    WHERE v.active = 1 AND p.active = 1 AND c.active = 1`,
    )
    .all<{
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
    const variant = (variants.results || []).find(
      (item) => item.productId === productId && item.size === size,
    )
    if (!variant) throw new Error('A cart variant is unavailable.')
    assertAvailableStock(quantity, variant.stock)
    return { ...variant, quantity, total: variant.unitPrice * quantity }
  })
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0)
  const itemsCount = lines.reduce((sum, line) => sum + line.quantity, 0)
  await database.batch([
    database
      .prepare(
        `INSERT INTO abandoned_carts
      (id, customer_name, phone, email, subtotal, items_count, state,
       contact_captured_at, created_at, last_activity)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET subtotal = excluded.subtotal,
      items_count = excluded.items_count, state = 'active', last_activity = excluded.last_activity,
      customer_name = COALESCE(excluded.customer_name, abandoned_carts.customer_name),
      phone = COALESCE(excluded.phone, abandoned_carts.phone),
      email = COALESCE(excluded.email, abandoned_carts.email),
      contact_captured_at = COALESCE(excluded.contact_captured_at, abandoned_carts.contact_captured_at)`,
      )
      .bind(
        input.cartId,
        contact?.name || null,
        contact?.phone || null,
        contact?.email || null,
        subtotal,
        itemsCount,
        contact ? now : null,
        now,
        now,
      ),
    database.prepare('DELETE FROM abandoned_cart_items WHERE cart_id = ?').bind(input.cartId),
    ...lines.map((line) =>
      database
        .prepare(
          `INSERT INTO abandoned_cart_items
      (id, cart_id, product_id, variant_id, product_name, variant, image, quantity, unit_price, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          input.cartId,
          line.productId,
          line.id,
          line.productName,
          `${line.color} / ${line.size}`,
          line.image,
          line.quantity,
          line.unitPrice,
          line.total,
        ),
    ),
  ])
  return { tracked: true }
}

const recoveryExpression = 'recovery_state'

export async function listAbandonedCarts(database: D1Database) {
  const result = await database
    .prepare(
      `SELECT id, customer_name AS customerName, phone, email,
    subtotal, items_count AS itemsCount, last_activity AS lastActivity, created_at AS createdAt,
    contact_captured_at AS contactCapturedAt, ${recoveryExpression} AS recoveryState
    FROM abandoned_carts WHERE state = 'active'
    AND recovery_state IN ('active', 'contacted')
    AND datetime(last_activity) <= datetime('now', '-${abandonmentMinutes} minutes')
    ORDER BY last_activity DESC LIMIT 100`,
    )
    .all<CartRow>()
  return result.results || []
}

export async function getAbandonedCart(
  database: D1Database,
  id: string,
): Promise<AbandonedCartDetail | null> {
  const cart = await database
    .prepare(
      `SELECT id, customer_name AS customerName, phone, email,
    subtotal, items_count AS itemsCount, last_activity AS lastActivity, created_at AS createdAt,
    contact_captured_at AS contactCapturedAt, ${recoveryExpression} AS recoveryState
    FROM abandoned_carts WHERE id = ?`,
    )
    .bind(id)
    .first<CartRow>()
  if (!cart) return null
  const items = await database
    .prepare(
      `SELECT id, product_id AS productId, product_name AS productName,
    variant, image, quantity, unit_price AS unitPrice, total
    FROM abandoned_cart_items WHERE cart_id = ? ORDER BY rowid`,
    )
    .bind(id)
    .all<AbandonedCartItem>()
  const events = await database
    .prepare(
      `SELECT id, from_state AS fromState, to_state AS toState,
    actor_email AS actorEmail, note, created_at AS createdAt
    FROM abandoned_cart_events WHERE cart_id = ? ORDER BY created_at DESC, rowid DESC`,
    )
    .bind(id)
    .all<CartRecoveryEvent>()
  return { ...cart, items: items.results || [], events: events.results || [] }
}

export async function updateRecoveryState(
  database: D1Database,
  cartId: string,
  nextState: CartRecoveryState,
  actorEmail: string,
  note?: string,
) {
  if (
    !cartId.trim() ||
    !actorEmail.trim() ||
    !['contacted', 'dismissed', 'recovered'].includes(nextState)
  ) {
    throw new Error('CART_RECOVERY_INVALID')
  }
  const cleanNote = note?.trim() || undefined
  if (cleanNote && cleanNote.length > 500) throw new Error('CART_RECOVERY_INVALID')
  const current = await database
    .prepare(
      `SELECT recovery_state AS state, phone, email
    FROM abandoned_carts WHERE id = ?`,
    )
    .bind(cartId)
    .first<{ state: CartRecoveryState; phone?: string; email?: string }>()
  if (!current) throw new Error('CART_NOT_FOUND')
  if (nextState !== 'dismissed' && !current.phone && !current.email) {
    throw new Error('CART_CONTACT_REQUIRED')
  }
  if (!manualRecoveryTransitions[current.state].includes(nextState))
    throw new Error('CART_RECOVERY_CONFLICT')
  const eventId = crypto.randomUUID()
  const changedAt = new Date().toISOString()
  const results = await database.batch([
    database
      .prepare(
        `INSERT INTO abandoned_cart_events
      (id, cart_id, from_state, to_state, actor_email, note, created_at)
      SELECT ?, id, recovery_state, ?, ?, ?, ? FROM abandoned_carts
      WHERE id = ? AND recovery_state = ?`,
      )
      .bind(
        eventId,
        nextState,
        actorEmail.trim(),
        cleanNote || null,
        changedAt,
        cartId,
        current.state,
      ),
    database
      .prepare(
        `UPDATE abandoned_carts SET recovery_state = ?,
      recovered_at = CASE WHEN ? = 'recovered' THEN ? ELSE recovered_at END
      WHERE id = ? AND recovery_state = ?
      AND EXISTS (SELECT 1 FROM abandoned_cart_events WHERE id = ?)`,
      )
      .bind(nextState, nextState, changedAt, cartId, current.state, eventId),
  ])
  if ((results[0]?.meta?.changes || 0) !== 1 || (results[1]?.meta?.changes || 0) !== 1) {
    throw new Error('CART_RECOVERY_CONFLICT')
  }
  return (await getAbandonedCart(database, cartId))!
}

export async function getAbandonedCartMetrics(database: D1Database, since?: string) {
  const row = await database
    .prepare(
      `SELECT
    COUNT(CASE WHEN state = 'active' AND recovery_state IN ('active', 'contacted')
      AND datetime(last_activity) <= datetime('now', '-${abandonmentMinutes} minutes') THEN 1 END) AS abandonedCount,
    COUNT(CASE WHEN recovery_state IN ('converted', 'recovered') THEN 1 END) AS recoveredCount,
    COALESCE(SUM(CASE WHEN recovery_state IN ('converted', 'recovered') THEN subtotal ELSE 0 END), 0) AS recoveredRevenue
    FROM abandoned_carts WHERE (? IS NULL OR datetime(created_at) >= datetime(?))`,
    )
    .bind(since || null, since || null)
    .first<{ abandonedCount: number; recoveredCount: number; recoveredRevenue: number }>()
  return {
    abandonedCount: Number(row?.abandonedCount || 0),
    recoveredCount: Number(row?.recoveredCount || 0),
    recoveredRevenue: Number(row?.recoveredRevenue || 0),
  }
}
