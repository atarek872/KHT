import {
  accountBody,
  requireCustomer,
  rateLimit,
  invalidAccount,
  destroyCustomerSession,
} from '../../utils/customerAuth'
import { validatePassword } from '../../services/customerAccounts'
import { hashPassword, verifyPassword } from '../../utils/password'
export default defineEventHandler(async (event) => {
  const body = await accountBody(event)
  const { user, database } = await requireCustomer(event)
  await rateLimit(event, 'credentials', user.id)
  let password
  try {
    password = validatePassword(body.password)
  } catch (error) {
    invalidAccount(error)
  }
  const row = await database
    .prepare('SELECT password_hash FROM customer_users WHERE id=?')
    .bind(user.id)
    .first<{ password_hash: string }>()
  if (
    typeof body.currentPassword !== 'string' ||
    body.currentPassword.length > 128 ||
    !row ||
    !(await verifyPassword(body.currentPassword, row.password_hash))
  )
    throw createError({ statusCode: 400, statusMessage: 'Current password is incorrect.' })
  await database.batch([
    database
      .prepare('UPDATE customer_users SET password_hash=?,updated_at=? WHERE id=?')
      .bind(await hashPassword(password), new Date().toISOString(), user.id),
    database.prepare('DELETE FROM customer_sessions WHERE user_id=?').bind(user.id),
    database.prepare('DELETE FROM customer_password_resets WHERE user_id=?').bind(user.id),
  ])
  await destroyCustomerSession(event)
  deleteCookie(event, 'kht-guest-cart', { path: '/' })
  return { ok: true }
})
