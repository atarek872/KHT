import {
  accountBody,
  rateLimit,
  createCustomerSession,
  invalidAccount,
} from '../../utils/customerAuth'
import { field, normalizeEmail, validatePassword } from '../../services/customerAccounts'
import { hashPassword } from '../../utils/password'
import { requireDatabase } from '../../utils/d1'
export default defineEventHandler(async (event) => {
  const body = await accountBody(event)
  await rateLimit(event, 'register')
  let user
  let password
  try {
    user = {
      id: crypto.randomUUID(),
      name: field(body.name, 'name', 100),
      email: normalizeEmail(body.email),
      phone: field(body.phone ?? '', 'phone', 30, false),
    }
    password = validatePassword(body.password)
  } catch (error) {
    invalidAccount(error)
  }
  const database = requireDatabase(event)
  const hash = await hashPassword(password)
  try {
    await database
      .prepare('INSERT INTO customer_users(id,name,email,phone,password_hash) VALUES(?,?,?,?,?)')
      .bind(user.id, user.name, user.email, user.phone, hash)
      .run()
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unable to create account. Try signing in or resetting your password.',
    })
  }
  await createCustomerSession(event, user.id)
  return { user }
})
