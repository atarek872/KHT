import type { StorefrontCheckoutInput } from '../../shared/storefrontOrder.ts'
import { createStorefrontOrder } from '../services/storefrontCheckout.ts'
import { requireDatabase } from '../utils/d1.ts'
import { enforceRateLimit } from '../utils/rateLimit.ts'
import { requireJsonBody } from '../utils/requestGuards.ts'

export default defineEventHandler(async (event) => {
  const database = requireDatabase(event)
  await enforceRateLimit(event, 'storefront-checkout', 12, 10 * 60)
  const input = await requireJsonBody<StorefrontCheckoutInput>(event, 32_768)
  try {
    return await createStorefrontOrder(database, input)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Review your bag and try again.'
    const conflict = /STOCK|VARIANT|available|coupon|DISCOUNT/i.test(message)
    throw createError({
      statusCode: conflict ? 409 : 400,
      statusMessage: conflict
        ? 'An item, coupon, or delivery option changed. Review your bag and try again.'
        : 'Review your checkout details and try again.',
    })
  }
})
