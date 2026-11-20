import type { StorefrontOrderLine, StorefrontOrderView } from '../../shared/storefrontOrder.ts'
import type { D1Database } from '../utils/d1.ts'
import { normalizeAdminPhone, normalizeEgyptianPhone } from './createOrder.ts'

interface PublicOrderRow extends Omit<StorefrontOrderView, 'lines'> {
  internalId: string
}

async function loadPublicOrder(
  database: D1Database,
  reference: string,
  normalizedPhone?: string,
): Promise<StorefrontOrderView | null> {
  const normalizedReference = reference.trim().toUpperCase()
  if (!normalizedReference.match(/^KHT-[A-Z0-9-]{8,60}$/)) return null
  const phoneConstraint = normalizedPhone ? 'AND c.phone_normalized = ?' : ''
  const statement = database.prepare(`SELECT o.id AS internalId,
    o.public_reference AS reference, o.subtotal, o.shipping, o.discount,
    o.discount_code AS discountCode, o.total, o.payment_method AS paymentMethod,
    o.payment_status AS paymentStatus, o.fulfillment_status AS fulfillmentStatus,
    o.created_at AS createdAt
    FROM orders o JOIN customers c ON c.id = o.customer_id
    WHERE o.public_reference = ? ${phoneConstraint}`)
  const order = normalizedPhone
    ? await statement.bind(normalizedReference, normalizedPhone).first<PublicOrderRow>()
    : await statement.bind(normalizedReference).first<PublicOrderRow>()
  if (!order) return null
  const lines = await database
    .prepare(
      `SELECT i.product_name AS productName,
      COALESCE((SELECT GROUP_CONCAT(
        (CASE cp.category WHEN 'hoodies' THEN 'Hoodie' WHEN 'sweatpants' THEN 'Pants'
          ELSE cv.product_name END) || ' ' || cv.size || ' ×' || c.quantity, ' / ')
        FROM order_item_components c JOIN inventory_variants cv ON cv.id=c.variant_id
        JOIN products cp ON cp.id=cv.product_id WHERE c.order_item_id=i.id),i.variant) AS variant,
      p.image,
    i.quantity, i.unit_price AS unitPrice, i.total FROM order_items i
    LEFT JOIN inventory_variants v ON v.id = i.variant_id
    LEFT JOIN products p ON p.id = v.product_id
    WHERE i.order_id = ? ORDER BY i.rowid`,
    )
    .bind(order.internalId)
    .all<StorefrontOrderLine>()
  const { internalId: _, ...publicOrder } = order
  return { ...publicOrder, lines: lines.results || [] }
}

export function getOrderConfirmation(database: D1Database, reference: string) {
  return loadPublicOrder(database, reference)
}

export async function trackOrder(database: D1Database, reference: string, phone: string) {
  let normalizedPhone: string
  try {
    normalizedPhone = /^\s*(?:\+1|001)/.test(phone)
      ? normalizeAdminPhone(phone, 'US')
      : normalizeEgyptianPhone(phone)
  } catch {
    return null
  }
  return loadPublicOrder(database, reference, normalizedPhone)
}
