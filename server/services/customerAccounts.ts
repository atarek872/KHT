import type { D1Database } from '../utils/d1'
import { digest, hashPassword } from '../utils/password.ts'
export function field(value: unknown, name: string, max: number, required = true) {
  if (typeof value !== 'string' || value.length > max) throw new Error(`Invalid ${name}.`)
  const clean = value.trim()
  if (required && !clean) throw new Error(`Invalid ${name}.`)
  return clean
}
export function normalizeEmail(value: unknown) {
  const email = field(value, 'email', 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email.')
  return email
}
export function validatePassword(value: unknown) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128)
    throw new Error('Password must contain 12 to 128 characters.')
  return value
}
export async function resetCustomerPassword(database: D1Database, token: string, password: string) {
  const hash = await digest(token)
  const now = new Date().toISOString()
  const passwordHash = await hashPassword(validatePassword(password))
  const eligible =
    'SELECT user_id FROM customer_password_resets WHERE token_hash = ? AND expires_at > ?'
  const result = await database.batch([
    database
      .prepare(
        `UPDATE customer_users SET password_hash = ?, updated_at = ? WHERE id IN (${eligible})`,
      )
      .bind(passwordHash, now, hash, now),
    database
      .prepare(`DELETE FROM customer_sessions WHERE user_id IN (${eligible})`)
      .bind(hash, now),
    database
      .prepare(`DELETE FROM customer_password_resets WHERE user_id IN (${eligible})`)
      .bind(hash, now),
  ])
  return (result[0]?.meta?.changes || 0) > 0
}
