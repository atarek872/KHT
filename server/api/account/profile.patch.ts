import { accountBody, requireCustomer, rateLimit, invalidAccount } from '../../utils/customerAuth'
import { field, normalizeEmail } from '../../services/customerAccounts'
import { verifyPassword } from '../../utils/password'
export default defineEventHandler(async (event) => {
  const body = await accountBody(event)
  const { user, database } = await requireCustomer(event)
  await rateLimit(event, 'write', user.id)
  let name
  let email
  let phone
  try {
    name = field(body.name, 'name', 100)
    email = normalizeEmail(body.email)
    phone = field(body.phone ?? '', 'phone', 30, false)
  } catch (error) {
    invalidAccount(error)
  }
  if (email !== user.email) {
    await rateLimit(event, 'credentials', user.id)
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
  }
  try {
    await database.batch([
      database
        .prepare('UPDATE customer_users SET name=?,email=?,phone=?,updated_at=? WHERE id=?')
        .bind(name, email, phone, new Date().toISOString(), user.id),
      ...(email !== user.email
        ? [database.prepare('DELETE FROM customer_password_resets WHERE user_id=?').bind(user.id)]
        : []),
    ])
  } catch {
    invalidAccount(null)
  }
  return { user: { id: user.id, name, email, phone } }
})
