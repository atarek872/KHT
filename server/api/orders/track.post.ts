import { trackOrder } from '../../services/storefrontOrders.ts'
import { requireDatabase } from '../../utils/d1.ts'
import { enforceRateLimit } from '../../utils/rateLimit.ts'
import { requireJsonBody } from '../../utils/requestGuards.ts'

export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'order-tracking', 20, 10 * 60)
  const body = await requireJsonBody<{ reference?: string; phone?: string }>(event, 4_096)
  const order = await trackOrder(
    requireDatabase(event),
    String(body?.reference || ''),
    String(body?.phone || ''),
  )
  if (!order) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No order matches that reference and phone number.',
    })
  }
  return order
})
