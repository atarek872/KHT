import { accountBody, rateLimit, invalidAccount } from '../../utils/customerAuth'
import { normalizeEmail } from '../../services/customerAccounts'
import {
  mailConfigured,
  sendPasswordReset,
  type CustomerMailConfig,
} from '../../services/customerMail'
import { digest } from '../../utils/password'
import { requireDatabase } from '../../utils/d1'
export default defineEventHandler(async (event) => {
  const body = await accountBody(event)
  await rateLimit(event, 'forgot')
  let email
  try {
    email = normalizeEmail(body.email)
  } catch (error) {
    invalidAccount(error)
  }
  await rateLimit(event, 'forgot-email', email)
  const config = (event.context.cloudflare?.env || {}) as CustomerMailConfig
  const unavailable = () =>
    createError({
      statusCode: 503,
      statusMessage: 'Password reset is temporarily unavailable. Please try again later.',
    })
  if (!mailConfigured(config)) throw unavailable()
  const database = requireDatabase(event)
  const user = await database
    .prepare('SELECT id FROM customer_users WHERE email=?')
    .bind(email)
    .first<{ id: string }>()
  if (user) {
    const token = crypto.randomUUID() + crypto.randomUUID()
    const hash = await digest(token)
    await database.batch([
      database.prepare('DELETE FROM customer_password_resets WHERE user_id=?').bind(user.id),
      database
        .prepare(
          'INSERT INTO customer_password_resets(token_hash,user_id,expires_at) VALUES(?,?,?)',
        )
        .bind(hash, user.id, new Date(Date.now() + 30 * 60000).toISOString()),
    ])
    try {
      await sendPasswordReset(config, email, token)
    } catch {
      await database
        .prepare('DELETE FROM customer_password_resets WHERE token_hash=?')
        .bind(hash)
        .run()
    }
  }
  return {
    ok: true,
    message: 'If an account exists for this email, you will receive a password reset link.',
  }
})
