import { ORDER_SOURCES, type OrderSource } from '../../../../../shared/adminOrder'
import { requireAdmin } from '../../../../utils/adminAuth'
import { requireJsonBody, requireSameOrigin } from '../../../../utils/requestGuards'
import { updateOrderSource } from '../../../../services/orderSource'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const { database, email } = await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  const body = await requireJsonBody<{ source?: unknown }>(event, 1024)
  if (!id || !ORDER_SOURCES.includes(body?.source as OrderSource))
    throw createError({ statusCode: 400, statusMessage: 'Choose a valid order source.' })
  try {
    return await updateOrderSource(database, id, body.source as OrderSource, email)
  } catch (error) {
    if (error instanceof Error && error.message === 'ORDER_NOT_FOUND')
      throw createError({ statusCode: 404, statusMessage: 'Order not found.' })
    throw createError({ statusCode: 409, statusMessage: 'Order changed. Refresh and try again.' })
  }
})
