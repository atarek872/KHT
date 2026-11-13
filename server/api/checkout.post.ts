import type { StorefrontCheckoutInput } from '../../shared/storefrontOrder.ts'
import { createStorefrontOrder } from '../services/storefrontCheckout.ts'
import { requireDatabase } from '../utils/d1.ts'
import { enforceRateLimit } from '../utils/rateLimit.ts'
import { requireJsonBody, requireSameOrigin } from '../utils/requestGuards.ts'
import { sanitizeCampaignAttribution } from '../../shared/campaignAttribution.ts'
import { metaRequestContext, scheduleMetaDelivery } from '../utils/metaRequest.ts'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const database = requireDatabase(event)
  await enforceRateLimit(event, 'storefront-checkout', 12, 10 * 60)
  const input = await requireJsonBody<StorefrontCheckoutInput>(event, 32_768)
  try {
    const result = await createStorefrontOrder(
      database,
      input,
      metaRequestContext(event, '/checkout', sanitizeCampaignAttribution(input.attribution)),
    )
    scheduleMetaDelivery(event, database, 'Purchase', result.reference)
    return result
  } catch (error) {
    // A simultaneous submit may commit after our idempotency check and win the unique-key race.
    // Resolve that committed order through the existing service before returning a conflict.
    if (/^[a-f0-9-]{20,80}$/i.test(input.requestId || '')) {
      const duplicate = await database
        .prepare('SELECT id FROM orders WHERE idempotency_key = ?')
        .bind(input.requestId)
        .first<{ id: string }>()
      if (duplicate) {
        const result = await createStorefrontOrder(database, input)
        scheduleMetaDelivery(event, database, 'Purchase', result.reference)
        return result
      }
    }
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
