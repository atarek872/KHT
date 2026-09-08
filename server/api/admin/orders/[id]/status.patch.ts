import { requireAdmin } from '../../../../utils/adminAuth'
import { requireSameOrigin } from '../../../../utils/customerAuth'
import { transitionAdminOrder } from '../../../../services/adminOrders'
import type { OrderFulfillmentStatus } from '../../../../../shared/adminOrder'
export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const { database } = await requireAdmin(event)
  const body = await readBody(event)
  if (!body || typeof body.status !== 'string' || typeof body.expectedStatus !== 'string')
    throw createError({
      statusCode: 400,
      statusMessage: 'Status and expected status are required.',
    })
  for (const field of ['trackingNumber', 'trackingCarrier']) {
    if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].length > 200))
      throw createError({ statusCode: 400, statusMessage: 'Invalid tracking details.' })
  }
  return transitionAdminOrder(
    database,
    getRouterParam(event, 'id') || '',
    body.expectedStatus as OrderFulfillmentStatus,
    body.status as OrderFulfillmentStatus,
    body.trackingNumber?.trim(),
    body.trackingCarrier?.trim(),
  )
})
