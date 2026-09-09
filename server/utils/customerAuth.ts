import type { H3Event } from 'h3'
import type { CustomerUser } from '../../shared/account'
import { requireDatabase } from './d1'
import { digest } from './password'
import { isSecureRequest } from './requestSecurity'

const cookie = 'kht-customer-session'
export function requireCustomerOrigin(event: H3Event) {
  const origin = getHeader(event, 'origin')
  if (!origin || origin !== getRequestURL(event).origin)
    throw createError({ statusCode: 403, statusMessage: 'Request origin is not allowed.' })
}
export async function accountBody(event: H3Event): Promise<Record<string, unknown>> {
  requireCustomerOrigin(event)
  if (!getHeader(event, 'content-type')?.startsWith('application/json'))
    throw createError({ statusCode: 415, statusMessage: 'JSON is required.' })
  if (Number(getHeader(event, 'content-length') || 0) > 16384)
    throw createError({ statusCode: 413, statusMessage: 'Request is too large.' })
  const raw = await readRawBody(event)
  if (!raw || new TextEncoder().encode(raw).length > 16384)
    throw createError({ statusCode: 413, statusMessage: 'Request is too large.' })
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid JSON.' })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw createError({ statusCode: 400, statusMessage: 'Invalid request.' })
  return body as Record<string, unknown>
}
export async function rateLimit(event: H3Event, scope: string, identifier?: string) {
  const database = requireDatabase(event)
  const now = Date.now()
  const identities = [
    `ip:${getHeader(event, 'cf-connecting-ip') || event.node.req.socket?.remoteAddress || 'unknown'}`,
  ]
  if (identifier) identities.push(`identity:${identifier.toLowerCase()}`)
  for (const identity of identities) {
    const key = await digest(`${scope}:${identity}`)
    const row = await database
      .prepare(
        `INSERT INTO customer_rate_limits(key, attempts, expires_at) VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN expires_at <= ? THEN 1 ELSE attempts + 1 END,
      expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END RETURNING attempts`,
      )
      .bind(key, now + 15 * 60 * 1000, now, now)
      .first<{ attempts: number }>()
    if (!row || row.attempts > (scope === 'write' ? 60 : 10))
      throw createError({ statusCode: 429, statusMessage: 'Too many requests. Try again later.' })
  }
  await database.prepare('DELETE FROM customer_rate_limits WHERE expires_at < ?').bind(now).run()
}
export async function getCustomer(event: H3Event): Promise<CustomerUser | null> {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const token = getCookie(event, cookie)
  if (!token || token.length > 200) return null
  return requireDatabase(event)
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone FROM customer_users u JOIN customer_sessions s ON s.user_id = u.id WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .bind(await digest(token), new Date().toISOString())
    .first<CustomerUser>()
}
export async function requireCustomer(event: H3Event) {
  const user = await getCustomer(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Please sign in.' })
  return { user, database: requireDatabase(event) }
}
export async function createCustomerSession(event: H3Event, userId: string) {
  const token = crypto.randomUUID() + crypto.randomUUID()
  const expires = new Date(Date.now() + 30 * 86400000)
  const database = requireDatabase(event)
  await database
    .prepare('INSERT INTO customer_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)')
    .bind(await digest(token), userId, expires.toISOString())
    .run()
  setCookie(event, cookie, token, {
    httpOnly: true,
    secure: isSecureRequest(getRequestURL(event)),
    sameSite: 'lax',
    path: '/',
    expires,
  })
}
export async function destroyCustomerSession(event: H3Event) {
  const token = getCookie(event, cookie)
  if (token)
    await requireDatabase(event)
      .prepare('DELETE FROM customer_sessions WHERE token_hash = ?')
      .bind(await digest(token))
      .run()
  deleteCookie(event, cookie, { path: '/' })
}
export function invalidAccount(error: unknown): never {
  throw createError({
    statusCode: 400,
    statusMessage:
      error instanceof Error && /^(Invalid |Password must)/.test(error.message)
        ? error.message
        : 'Unable to save account details.',
  })
}
