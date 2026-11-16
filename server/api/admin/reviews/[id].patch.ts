import { moderateProductReview } from '../../../services/productReviews'
import { requireAdmin } from '../../../utils/adminAuth'
import { requireJsonBody, requireSameOrigin } from '../../../utils/requestGuards'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const { database, email } = await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  const body = await requireJsonBody<{ status?: unknown }>(event, 1024)
  if (!id || !['approved', 'rejected'].includes(String(body?.status)))
    throw createError({ statusCode: 400, statusMessage: 'Choose approve or reject.' })
  try {
    return await moderateProductReview(database, id, body.status as 'approved' | 'rejected', email)
  } catch {
    throw createError({ statusCode: 409, statusMessage: 'Review changed. Refresh and try again.' })
  }
})
