import type { D1Database } from './d1'
import { requireDatabase } from './d1'

const sessionCookie = 'kht-admin-session'

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function verifyPassword(password: string, encoded: string) {
  const [iterationsText, saltText, expectedText] = encoded.split(':')
  const iterations = Number(iterationsText)
  if (!iterations || !saltText || !expectedText) return false
  const decode = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
  const salt = decode(saltText)
  const expected = decode(expectedText)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const actual = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256),
  )
  if (actual.length !== expected.length) return false
  let difference = 0
  for (let index = 0; index < actual.length; index++) difference |= actual[index]! ^ expected[index]!
  return difference === 0
}

function adminConfig(event: { context: Record<string, unknown> }) {
  const cloudflare = event.context.cloudflare as {
    env?: { ADMIN_EMAIL?: string; ADMIN_PASSWORD_HASH?: string }
  }
  return cloudflare?.env || {}
}

export async function createAdminSession(
  event: Parameters<typeof setCookie>[0] & { context: Record<string, unknown> },
  email: string,
  password: string,
) {
  const config = adminConfig(event)
  if (!config.ADMIN_EMAIL || !config.ADMIN_PASSWORD_HASH) return false
  if (email.trim().toLowerCase() !== config.ADMIN_EMAIL.trim().toLowerCase()) return false
  if (!(await verifyPassword(password, config.ADMIN_PASSWORD_HASH))) return false

  const database = requireDatabase(event)
  const token = crypto.randomUUID() + crypto.randomUUID()
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000)
  await database
    .prepare('INSERT INTO admin_sessions (token_hash, email, expires_at) VALUES (?, ?, ?)')
    .bind(await digest(token), config.ADMIN_EMAIL, expires.toISOString())
    .run()
  setCookie(event, sessionCookie, token, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'strict',
    path: '/',
    expires,
  })
  return true
}

export async function requireAdmin(
  event: Parameters<typeof getCookie>[0] & { context: Record<string, unknown> },
) {
  const token = getCookie(event, sessionCookie)
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Admin authentication required.' })
  const database = requireDatabase(event)
  const session = await database
    .prepare('SELECT email FROM admin_sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await digest(token), new Date().toISOString())
    .first<{ email: string }>()
  if (!session) throw createError({ statusCode: 401, statusMessage: 'Admin session expired.' })
  return { database, email: session.email }
}

export async function destroyAdminSession(
  event: Parameters<typeof getCookie>[0] & { context: Record<string, unknown> },
) {
  const token = getCookie(event, sessionCookie)
  if (token) {
    const database = requireDatabase(event)
    await database.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await digest(token)).run()
  }
  deleteCookie(event, sessionCookie, { path: '/' })
}