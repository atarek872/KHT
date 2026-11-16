import type { D1Database } from '../utils/d1'
import type {
  AdminProductReview,
  ProductReview,
  ProductReviewResponse,
} from '../../shared/productReview'
import { normalizeCheckoutPhone } from '../../shared/checkoutSteps.ts'

export async function publicProductReviews(
  database: D1Database,
  productId: string,
): Promise<ProductReviewResponse> {
  const rows = await database
    .prepare(
      `SELECT id, display_name AS displayName, rating, body,
    created_at AS createdAt FROM product_reviews WHERE product_id=? AND status='approved'
    ORDER BY created_at DESC LIMIT 40`,
    )
    .bind(productId)
    .all<ProductReview>()
  const summary = await database
    .prepare(
      `SELECT COUNT(*) AS count, AVG(rating) AS average
    FROM product_reviews WHERE product_id=? AND status='approved'`,
    )
    .bind(productId)
    .first<{ count: number; average: number | null }>()
  return {
    reviews: rows.results || [],
    count: summary?.count || 0,
    average: summary?.average || null,
  }
}

export async function submitProductReview(
  database: D1Database,
  productId: string,
  input: {
    reference: unknown
    phone: unknown
    displayName: unknown
    rating: unknown
    body: unknown
  },
) {
  const reference = typeof input.reference === 'string' ? input.reference.trim().toUpperCase() : ''
  const phone = typeof input.phone === 'string' ? normalizeCheckoutPhone(input.phone) : null
  const displayName =
    typeof input.displayName === 'string' ? input.displayName.trim().replace(/\s+/g, ' ') : ''
  const body = typeof input.body === 'string' ? input.body.trim() : ''
  if (
    !/^[A-Z0-9-]{6,80}$/.test(reference) ||
    !phone ||
    displayName.length < 2 ||
    displayName.length > 50 ||
    !Number.isInteger(input.rating) ||
    Number(input.rating) < 1 ||
    Number(input.rating) > 5 ||
    body.length < 12 ||
    body.length > 1000
  )
    throw new Error('Check the order, display name, rating and review text.')
  const order = await database
    .prepare(
      `SELECT o.id, c.phone, o.fulfillment_status AS status
    FROM orders o JOIN customers c ON c.id=o.customer_id
    WHERE (o.public_reference=? OR o.number=?) AND EXISTS (
      SELECT 1 FROM order_items oi JOIN inventory_variants v ON v.id=oi.variant_id
      WHERE oi.order_id=o.id AND v.product_id=?
    ) LIMIT 1`,
    )
    .bind(reference, reference, productId)
    .first<{ id: string; phone: string; status: string }>()
  if (!order || normalizeCheckoutPhone(order.phone) !== phone || order.status !== 'delivered')
    throw new Error(
      'Review requires a delivered order containing this product and its matching phone number.',
    )
  const result = await database
    .prepare(
      `INSERT OR IGNORE INTO product_reviews
    (id,order_id,product_id,display_name,rating,body) VALUES (?,?,?,?,?,?)`,
    )
    .bind(crypto.randomUUID(), order.id, productId, displayName, input.rating, body)
    .run()
  if (result.meta?.changes !== 1)
    throw new Error('A review for this product and order already exists.')
  return { submitted: true as const }
}

export async function adminProductReviews(database: D1Database) {
  const result = await database
    .prepare(
      `SELECT r.id, r.display_name AS displayName, r.rating, r.body,
    r.created_at AS createdAt, r.status, p.name_en AS productName, o.number AS orderNumber
    FROM product_reviews r JOIN products p ON p.id=r.product_id
    LEFT JOIN orders o ON o.id=r.order_id
    ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 200`,
    )
    .all<AdminProductReview>()
  return result.results || []
}

export async function moderateProductReview(
  database: D1Database,
  id: string,
  status: 'approved' | 'rejected',
  actor: string,
) {
  const result = await database
    .prepare(
      `UPDATE product_reviews SET status=?, moderated_at=?, moderated_by=?
    WHERE id=? AND status != ?`,
    )
    .bind(status, new Date().toISOString(), actor, id, status)
    .run()
  if (result.meta?.changes !== 1) throw new Error('Review not found or already has this status.')
  return { status }
}
