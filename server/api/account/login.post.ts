import {
  accountBody,
  rateLimit,
  createCustomerSession,
  invalidAccount,
} from '../../utils/customerAuth'
import { normalizeEmail } from '../../services/customerAccounts'
import { hashPassword, verifyPassword } from '../../utils/password'
import { requireDatabase } from '../../utils/d1'
import type { CustomerUser } from '../../../shared/account'
export default defineEventHandler(async (event) => {
  const body = await accountBody(event)
  await rateLimit(event, 'login')
  let email
  let password
  try {
    email = normalizeEmail(body.email)
    if (typeof body.password !== 'string' || !body.password.length || body.password.length > 128)
      throw new Error('Invalid password.')
    password = body.password
  } catch (error) {
    invalidAccount(error)
  }
  await rateLimit(event, 'login-email', email)
  const row = await requireDatabase(event)
    .prepare('SELECT id,name,email,phone,password_hash FROM customer_users WHERE email = ?')
    .bind(email)
    .first<CustomerUser & { password_hash: string }>()
  const valid = await verifyPassword(
    password,
    row?.password_hash || (await hashPassword('unmatched dummy account password')),
  )
  if (!row || !valid)
    throw createError({ statusCode: 401, statusMessage: 'Email or password is incorrect.' })
  await createCustomerSession(event, row.id)
  const { password_hash, ...user } = row
  return { user }
})
