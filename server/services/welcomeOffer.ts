import type { D1Database } from '../utils/d1'

export const WELCOME_DISCOUNT_CODE = 'WELCOME5'

interface CustomerDiscountOptions {
  userId?: string | null
  requestedCode?: string
  automaticWelcome?: boolean
}

export async function customerCanUseWelcomeOffer(database: D1Database, userId?: string | null) {
  if (!userId) return false
  const previousOrder = await database
    .prepare('SELECT 1 AS found FROM orders WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first<{ found: number }>()
  return !previousOrder
}

export async function resolveCustomerDiscountCode(
  database: D1Database,
  options: CustomerDiscountOptions = {},
) {
  const requestedCode = options.requestedCode?.trim().toUpperCase() || undefined
  if (requestedCode && requestedCode !== WELCOME_DISCOUNT_CODE) return requestedCode

  const eligible = await customerCanUseWelcomeOffer(database, options.userId)
  if (requestedCode === WELCOME_DISCOUNT_CODE && !eligible) {
    throw new Error('The welcome gift is available on your signed-in first order only.')
  }
  if (requestedCode === WELCOME_DISCOUNT_CODE || (options.automaticWelcome && eligible)) {
    return WELCOME_DISCOUNT_CODE
  }
  return undefined
}
