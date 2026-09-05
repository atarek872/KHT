import { restockReturnedOrder } from '../../../../services/orderTransitions'
import { requireAdmin } from '../../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database, email } = await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  const body = await readBody<{ note?: unknown }>(event)
  if (!id || (body?.note !== undefined && typeof body.note !== 'string')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid restock request.' })
  }
  try {
    return await restockReturnedOrder(database, id, email, body?.note as string | undefined)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ORDER_RESTOCK_CONFLICT'
    const statusCode =
      message === 'ORDER_NOT_FOUND' ? 404 : message === 'ORDER_INVALID_INPUT' ? 400 : 409
    const statusMessage =
      statusCode === 404
        ? 'Order not found.'
        : statusCode === 400
          ? 'Invalid restock request.'
          : 'Only an un-restocked returned order can be restocked.'
    throw createError({ statusCode, statusMessage })
  }
})
