import type { D1Database } from './d1.ts'
import { requireDatabase } from './d1.ts'

type RequestEvent = Parameters<typeof getHeader>[0] & { context: Record<string, unknown> }

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfter: number
}

export async function consumeRateLimit(
  database: D1Database,
  keyHash: string,
  limit: number,
  windowSeconds: number,
  now = new Date(),
): Promise<RateLimitResult> {
  const nowText = now.toISOString()
  const expiresAt = new Date(now.getTime() + windowSeconds * 1000).toISOString()
  await database
    .prepare(
      `INSERT INTO request_rate_limits (key_hash, request_count, expires_at)
       VALUES (?, 1, ?)
       ON CONFLICT(key_hash) DO UPDATE SET
         request_count = CASE
           WHEN request_rate_limits.expires_at <= ? THEN 1
           ELSE request_rate_limits.request_count + 1
         END,
         expires_at = CASE
           WHEN request_rate_limits.expires_at <= ? THEN excluded.expires_at
           ELSE request_rate_limits.expires_at
         END`,
    )
    .bind(keyHash, expiresAt, nowText, nowText)
    .run()

  const row = await database
    .prepare('SELECT request_count, expires_at FROM request_rate_limits WHERE key_hash = ?')
    .bind(keyHash)
    .first<{ request_count: number; expires_at: string }>()
  const count = Number(row?.request_count || limit + 1)
  const expiry = new Date(row?.expires_at || expiresAt).getTime()
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfter: Math.max(1, Math.ceil((expiry - now.getTime()) / 1000)),
  }
}

async function hashRateLimitKey(scope: string, connectingIp: string) {
  const bytes = new TextEncoder().encode(`${scope}:${connectingIp}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function enforceRateLimit(
  event: RequestEvent,
  scope: string,
  limit: number,
  windowSeconds: number,
) {
  const forwarded =
    getHeader(event, 'cf-connecting-ip') || getHeader(event, 'x-forwarded-for') || ''
  const connectingIp = forwarded.split(',')[0]?.trim() || 'unknown-client'
  const result = await consumeRateLimit(
    requireDatabase(event),
    await hashRateLimitKey(scope, connectingIp),
    limit,
    windowSeconds,
  )
  setResponseHeader(event, 'X-RateLimit-Remaining', String(result.remaining))
  if (!result.allowed) {
    setResponseHeader(event, 'Retry-After', result.retryAfter)
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many requests. Wait before trying again.',
    })
  }
}
