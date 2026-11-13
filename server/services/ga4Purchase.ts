import type { D1Database, D1Statement } from '../utils/d1.ts'
import type { OrderVariantOption } from '../../shared/createOrder.ts'

export interface Ga4PurchasePayload {
  client_id: string
  timestamp_micros: number
  events: [
    {
      name: 'purchase'
      params: {
        transaction_id: string
        currency: 'EGP'
        value: number
        shipping: number
        coupon?: string
        items: {
          item_id: string
          item_name: string
          item_brand: 'KHT'
          item_category?: string
          item_variant: string
          price: number
          discount?: number
          quantity: number
        }[]
        session_id?: string
        engagement_time_msec: number
        debug_mode?: boolean
      }
    },
  ]
}

export function ga4ClientId(cookie: string | undefined, fallback: string) {
  const match = cookie?.match(/^GA\d+\.\d+\.(\d+\.\d+)$/)
  if (match) return match[1]!
  const bytes = new TextEncoder().encode(fallback)
  let hash = 2166136261
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619)
  return `${hash >>> 0}.${Math.floor(Date.now() / 1000)}`
}

export function ga4SessionId(cookie: string | undefined) {
  if (!cookie || cookie.length > 200) return undefined
  return /^GS[12]\.\d\.[A-Za-z0-9.$-]+$/.test(cookie) ? cookie : undefined
}

export function purchaseGa4Payload(input: {
  reference: string
  createdAt: string
  clientId: string
  sessionId?: string
  lines: { variant: OrderVariantOption; quantity: number }[]
  subtotal: number
  discount: number
  shipping: number
  couponCode?: string
  debug?: boolean
}): Ga4PurchasePayload {
  return {
    client_id: input.clientId,
    timestamp_micros: new Date(input.createdAt).getTime() * 1000,
    events: [
      {
        name: 'purchase',
        params: {
          transaction_id: input.reference,
          currency: 'EGP',
          value: Math.max(0, input.subtotal - input.discount),
          shipping: input.shipping,
          ...(input.couponCode ? { coupon: input.couponCode } : {}),
          items: input.lines.map(({ variant, quantity }) => ({
            item_id: variant.productCode || variant.productId,
            item_name: variant.productName,
            item_brand: 'KHT',
            ...(variant.productCategory ? { item_category: variant.productCategory } : {}),
            item_variant: `${variant.color} / ${variant.size}`,
            price: variant.unitPrice,
            ...(input.discount > 0 && input.subtotal > 0
              ? { discount: (input.discount * variant.unitPrice) / input.subtotal }
              : {}),
            quantity,
          })),
          ...(input.sessionId ? { session_id: input.sessionId } : {}),
          engagement_time_msec: 1,
          ...(input.debug ? { debug_mode: true } : {}),
        },
      },
    ],
  }
}

export function enqueueGa4Statement(
  database: D1Database,
  transactionId: string,
  payload: Ga4PurchasePayload,
): D1Statement {
  const now = new Date().toISOString()
  return database
    .prepare(
      `INSERT OR IGNORE INTO ga4_purchase_outbox
    (transaction_id, payload_json, next_attempt_at, created_at) VALUES (?, ?, ?, ?)`,
    )
    .bind(transactionId, JSON.stringify(payload), now, now)
}

interface Ga4OutboxRow {
  transactionId: string
  payloadJson: string
  attempts: number
}

export async function deliverGa4Outbox(
  database: D1Database,
  config: { measurementId?: string; apiSecret?: string },
  options: { transactionId?: string; limit?: number; send?: typeof fetch } = {},
) {
  if (!/^G-[A-Z0-9]+$/.test(config.measurementId || '') || !config.apiSecret)
    return { delivered: 0, retried: 0 }
  const now = new Date().toISOString()
  await database
    .prepare(
      `UPDATE ga4_purchase_outbox SET state='pending', lease_until=NULL
    WHERE state='sending' AND lease_until < ?`,
    )
    .bind(now)
    .run()
  const rows = await database
    .prepare(
      `SELECT transaction_id AS transactionId,
    payload_json AS payloadJson, attempts FROM ga4_purchase_outbox
    WHERE state='pending' AND next_attempt_at <= ?
    AND (? IS NULL OR transaction_id=?) ORDER BY created_at LIMIT ?`,
    )
    .bind(now, options.transactionId || null, options.transactionId || null, options.limit || 20)
    .all<Ga4OutboxRow>()
  let delivered = 0
  let retried = 0
  for (const row of rows.results || []) {
    const claim = await database
      .prepare(
        `UPDATE ga4_purchase_outbox SET state='sending', lease_until=?
      WHERE transaction_id=? AND state='pending' AND next_attempt_at <= ?`,
      )
      .bind(new Date(Date.now() + 30_000).toISOString(), row.transactionId, now)
      .run()
    if (!claim.meta?.changes) continue
    try {
      const response = await (options.send || fetch)(
        `https://www.google-analytics.com/mp/collect?measurement_id=${config.measurementId}&api_secret=${encodeURIComponent(config.apiSecret)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: row.payloadJson,
          signal: AbortSignal.timeout(10_000),
        },
      )
      if (!response.ok) throw new Error(`GA4_HTTP_${response.status}`)
      await database
        .prepare(
          `UPDATE ga4_purchase_outbox SET state='sent', payload_json=NULL,
        delivered_at=?, lease_until=NULL WHERE transaction_id=? AND state='sending'`,
        )
        .bind(new Date().toISOString(), row.transactionId)
        .run()
      delivered++
    } catch (error) {
      const attempts = row.attempts + 1
      const state = attempts >= 12 ? 'dead' : 'pending'
      const delayMinutes = Math.min(1440, 2 ** Math.min(attempts, 10))
      await database
        .prepare(
          `UPDATE ga4_purchase_outbox SET state=?, attempts=?,
        next_attempt_at=?, lease_until=NULL, payload_json=CASE WHEN ?='dead' THEN NULL ELSE payload_json END
        WHERE transaction_id=? AND state='sending'`,
        )
        .bind(
          state,
          attempts,
          new Date(Date.now() + delayMinutes * 60_000).toISOString(),
          state,
          row.transactionId,
        )
        .run()
      console.warn('GA4 purchase delivery failed', {
        status:
          error instanceof Error && /^GA4_HTTP_\d+$/.test(error.message)
            ? error.message
            : 'NETWORK_ERROR',
        attempt: attempts,
      })
      retried++
    }
  }
  return { delivered, retried }
}
