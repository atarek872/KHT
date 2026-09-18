import type { H3Event } from 'h3'
import { digest, verifyPassword } from './password'
import type { D1Database } from './d1'
import { requireDatabase } from './d1'
import { isSecureRequest, isTrustedRequestOrigin } from './requestSecurity'

const sessionCookie = 'kht-admin-session'

function adminConfig(event: H3Event) {
  const cloudflare = event.context.cloudflare as {
    env?: { ADMIN_EMAIL?: string; ADMIN_PASSWORD_HASH?: string }
  }
  return cloudflare?.env || {}
}

function protectAdminResponse(event: H3Event) {
  setHeader(event, 'Cache-Control', 'private, no-store')
}

function requireAdminOrigin(event: H3Event) {
  if (!isTrustedRequestOrigin(getHeader(event, 'origin'), getRequestURL(event)))
    throw createError({ statusCode: 403, statusMessage: 'Admin request origin is not allowed.' })
}

export async function createAdminSession(event: H3Event, email: string, password: string) {
  protectAdminResponse(event)
  requireAdminOrigin(event)
  const config = adminConfig(event)
  if (!config.ADMIN_EMAIL || !config.ADMIN_PASSWORD_HASH) return false
  const emailMatches = email.trim().toLowerCase() === config.ADMIN_EMAIL.trim().toLowerCase()
  const passwordMatches = await verifyPassword(password, config.ADMIN_PASSWORD_HASH)
  if (!emailMatches || !passwordMatches) return false

  const database = requireDatabase(event)
  const token = crypto.randomUUID() + crypto.randomUUID()
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000)
  await database
    .prepare('INSERT INTO admin_sessions (token_hash, email, expires_at) VALUES (?, ?, ?)')
    .bind(await digest(token), config.ADMIN_EMAIL, expires.toISOString())
    .run()
  setCookie(event, sessionCookie, token, {
    httpOnly: true,
    secure: isSecureRequest(getRequestURL(event)),
    sameSite: 'strict',
    path: '/',
    expires,
  })
  return true
}

export async function requireAdmin(event: H3Event) {
  protectAdminResponse(event)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(event.method)) requireAdminOrigin(event)
  const token = getCookie(event, sessionCookie)
  if (!token)
    throw createError({ statusCode: 401, statusMessage: 'Admin authentication required.' })
  const database = requireDatabase(event)
  const session = await database
    .prepare('SELECT email FROM admin_sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await digest(token), new Date().toISOString())
    .first<{ email: string }>()
  if (!session) throw createError({ statusCode: 401, statusMessage: 'Admin session expired.' })
  return { database, email: session.email }
}

export async function destroyAdminSession(event: H3Event) {
  protectAdminResponse(event)
  requireAdminOrigin(event)
  const token = getCookie(event, sessionCookie)
  if (token) {
    const database = requireDatabase(event)
    await database
      .prepare('DELETE FROM admin_sessions WHERE token_hash = ?')
      .bind(await digest(token))
      .run()
  }
  deleteCookie(event, sessionCookie, { path: '/' })
}
