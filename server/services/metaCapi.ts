import type { D1Database, D1Statement } from '../utils/d1.ts'
import type { OrderVariantOption } from '../../shared/createOrder.ts'

export type MetaCommerceEvent = 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase'

export interface MetaRequestContext {
  eventSourceUrl: string
  ip?: string
  userAgent?: string
  fbp?: string
  fbc?: string
  gaCookie?: string
  gaSessionCookie?: string
  ga4Debug?: boolean
  testEventCode?: string
}

export interface MetaEvent {
  event_name: MetaCommerceEvent
  event_time: number
  event_id: string
  action_source: 'website'
  event_source_url: string
  /** Outbox metadata, removed before sending the Graph API event. */
  testEventCode?: string
  user_data: {
    client_ip_address?: string
    client_user_agent?: string
    fbp?: string
    fbc?: string
    em?: string[]
    ph?: string[]
  }
  custom_data: {
    currency: 'EGP'
    value: number
    content_ids: string[]
    contents: { id: string; quantity: number; item_price: number }[]
    num_items: number
    order_id?: string
  }
}

export interface MetaConfiguration {
  pixelId?: string
  accessToken?: string
  apiVersion?: string
  testEventCode?: string
}

export function metaConfiguration(env: Record<string, unknown> | undefined): MetaConfiguration {
  return {
    pixelId:
      typeof env?.NUXT_PUBLIC_META_PIXEL_ID === 'string' ? env.NUXT_PUBLIC_META_PIXEL_ID : '',
    accessToken: typeof env?.META_CAPI_ACCESS_TOKEN === 'string' ? env.META_CAPI_ACCESS_TOKEN : '',
    apiVersion:
      typeof env?.META_GRAPH_API_VERSION === 'string' ? env.META_GRAPH_API_VERSION : 'v27.0',
    testEventCode:
      typeof env?.META_CAPI_TEST_EVENT_CODE === 'string' ? env.META_CAPI_TEST_EVENT_CODE : '',
  }
}

export function safeMetaIdentifier(value: unknown, kind: 'fbp' | 'fbc') {
  if (typeof value !== 'string' || value.length > 250) return undefined
  return new RegExp(`^fb\\.1\\.[0-9]+\\.${kind === 'fbp' ? '[0-9]+' : '[A-Za-z0-9_.-]+'}$`).test(
    value,
  )
    ? value
    : undefined
}

export function normalizeMetaEmail(value: string | undefined) {
  const email = value?.trim().toLowerCase()
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined
}

export function normalizeMetaPhone(value: string | undefined) {
  if (!value) return undefined
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('0020')) digits = digits.slice(2)
  if (/^01[0125]\d{8}$/.test(digits)) digits = `20${digits.slice(1)}`
  return /^201[0125]\d{8}$/.test(digits) ? digits : undefined
}

export async function sha256Hex(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function metaUserData(
  context: MetaRequestContext,
  customer: { email?: string; phone?: string } = {},
): Promise<MetaEvent['user_data']> {
  const email = normalizeMetaEmail(customer.email)
  const phone = normalizeMetaPhone(customer.phone)
  return {
    ...(context.ip ? { client_ip_address: context.ip } : {}),
    ...(context.userAgent ? { client_user_agent: context.userAgent.slice(0, 500) } : {}),
    ...(safeMetaIdentifier(context.fbp, 'fbp') ? { fbp: context.fbp } : {}),
    ...(safeMetaIdentifier(context.fbc, 'fbc') ? { fbc: context.fbc } : {}),
    ...(email ? { em: [await sha256Hex(email)] } : {}),
    ...(phone ? { ph: [await sha256Hex(phone)] } : {}),
  }
}

export async function purchaseMetaEvent(input: {
  reference: string
  createdAt: string
  lines: { variant: OrderVariantOption; quantity: number }[]
  subtotal: number
  discount: number
  customer: { email?: string; phone?: string }
  context: MetaRequestContext
}): Promise<MetaEvent> {
  const contents = input.lines.map(({ variant, quantity }) => ({
    id: variant.productCode || variant.productId,
    quantity,
    item_price: variant.unitPrice,
  }))
  return {
    event_name: 'Purchase',
    event_time: Math.floor(new Date(input.createdAt).getTime() / 1000),
    event_id: input.reference,
    action_source: 'website',
    event_source_url: input.context.eventSourceUrl,
    ...(input.context.testEventCode ? { testEventCode: input.context.testEventCode } : {}),
    user_data: await metaUserData(input.context, input.customer),
    custom_data: {
      currency: 'EGP',
      value: Math.max(0, input.subtotal - input.discount),
      content_ids: [...new Set(contents.map((item) => item.id))],
      contents,
      num_items: contents.reduce((sum, item) => sum + item.quantity, 0),
      order_id: input.reference,
    },
  }
}

export function enqueueMetaStatement(database: D1Database, event: MetaEvent): D1Statement {
  const now = new Date().toISOString()
  return database
    .prepare(
      `INSERT OR IGNORE INTO meta_event_outbox
      (event_name, event_id, payload_json, next_attempt_at, created_at)
      VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(event.event_name, event.event_id, JSON.stringify(event), now, now)
}

export async function postMetaEvent(
  event: MetaEvent,
  config: MetaConfiguration,
  send: typeof fetch = fetch,
) {
  if (
    !/^\d{10,20}$/.test(config.pixelId || '') ||
    !/^v\d{1,2}\.\d$/.test(config.apiVersion || '') ||
    !config.accessToken
  )
    return false
  const { testEventCode, ...graphEvent } = event
  const response = await send(
    `https://graph.facebook.com/${config.apiVersion}/${config.pixelId}/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [graphEvent],
        access_token: config.accessToken,
        ...(testEventCode || config.testEventCode
          ? { test_event_code: testEventCode || config.testEventCode }
          : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    },
  )
  if (!response.ok) throw new Error(`META_HTTP_${response.status}`)
  const result = (await response.json()) as { events_received?: number }
  if (result.events_received !== 1) throw new Error('META_EVENT_REJECTED')
  return true
}

interface OutboxRow {
  eventName: string
  eventId: string
  payloadJson: string
  attempts: number
}

export async function deliverMetaOutbox(
  database: D1Database,
  config: MetaConfiguration,
  options: { eventName?: string; eventId?: string; limit?: number; send?: typeof fetch } = {},
) {
  if (!config.accessToken || !config.pixelId) return { delivered: 0, retried: 0 }
  const now = new Date().toISOString()
  await database
    .prepare(
      `UPDATE meta_event_outbox SET state='pending', lease_until=NULL
    WHERE state='sending' AND lease_until < ?`,
    )
    .bind(now)
    .run()
  const rows = await database
    .prepare(
      `SELECT event_name AS eventName, event_id AS eventId,
    payload_json AS payloadJson, attempts FROM meta_event_outbox
    WHERE state='pending' AND next_attempt_at <= ?
    AND (? IS NULL OR event_name=?) AND (? IS NULL OR event_id=?)
    ORDER BY created_at LIMIT ?`,
    )
    .bind(
      now,
      options.eventName || null,
      options.eventName || null,
      options.eventId || null,
      options.eventId || null,
      options.limit || 20,
    )
    .all<OutboxRow>()
  let delivered = 0
  let retried = 0
  for (const row of rows.results || []) {
    const leaseUntil = new Date(Date.now() + 30_000).toISOString()
    const claim = await database
      .prepare(
        `UPDATE meta_event_outbox SET state='sending', lease_until=?
      WHERE event_name=? AND event_id=? AND state='pending' AND next_attempt_at <= ?`,
      )
      .bind(leaseUntil, row.eventName, row.eventId, now)
      .run()
    if (!claim.meta?.changes) continue
    try {
      const accepted = await postMetaEvent(
        JSON.parse(row.payloadJson) as MetaEvent,
        config,
        options.send,
      )
      if (!accepted) throw new Error('META_NOT_CONFIGURED')
      await database
        .prepare(
          `UPDATE meta_event_outbox SET state='sent', payload_json=NULL,
        delivered_at=?, lease_until=NULL WHERE event_name=? AND event_id=? AND state='sending'`,
        )
        .bind(new Date().toISOString(), row.eventName, row.eventId)
        .run()
      delivered++
    } catch (error) {
      const attempts = row.attempts + 1
      const state = attempts >= 12 ? 'dead' : 'pending'
      const delayMinutes = Math.min(1440, 2 ** Math.min(attempts, 10))
      await database
        .prepare(
          `UPDATE meta_event_outbox SET state=?, attempts=?,
        next_attempt_at=?, lease_until=NULL, payload_json=CASE WHEN ?='dead' THEN NULL ELSE payload_json END
        WHERE event_name=? AND event_id=? AND state='sending'`,
        )
        .bind(
          state,
          attempts,
          new Date(Date.now() + delayMinutes * 60_000).toISOString(),
          state,
          row.eventName,
          row.eventId,
        )
        .run()
      console.warn('Meta CAPI delivery failed', {
        event: row.eventName,
        status:
          error instanceof Error && /^META_HTTP_\d+$/.test(error.message)
            ? error.message
            : 'NETWORK_OR_REJECTED',
        attempt: attempts,
      })
      retried++
    }
  }
  return { delivered, retried }
}
