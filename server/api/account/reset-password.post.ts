import { accountBody, rateLimit, invalidAccount } from '../../utils/customerAuth'
import { field, resetCustomerPassword } from '../../services/customerAccounts'
import { requireDatabase } from '../../utils/d1'
export default defineEventHandler(async (event) => {
  const body = await accountBody(event)
  await rateLimit(event, 'reset')
  let valid
  try {
    valid = await resetCustomerPassword(
      requireDatabase(event),
      field(body.token, 'token', 200),
      body.password as string,
    )
  } catch (error) {
    invalidAccount(error)
  }
  if (!valid)
    throw createError({ statusCode: 400, statusMessage: 'This reset link is invalid or expired.' })
  return { ok: true }
})
