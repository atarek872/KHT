import { submitProductReview } from '../../../services/productReviews'
import { requireDatabase } from '../../../utils/d1'
import { enforceRateLimit } from '../../../utils/rateLimit'
import { requireJsonBody, requireSameOrigin } from '../../../utils/requestGuards'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  await enforceRateLimit(event, 'product-review', 8, 60 * 60)
  const id = getRouterParam(event, 'id') || ''
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id))
    throw createError({ statusCode: 400, statusMessage: 'Invalid product.' })
  const input = await requireJsonBody<{
    reference: unknown
    phone: unknown
    displayName: unknown
    rating: unknown
    body: unknown
  }>(event, 4096)
  try {
    return await submitProductReview(requireDatabase(event), id, input)
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Review could not be submitted.',
    })
  }
})
