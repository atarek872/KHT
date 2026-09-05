import type { OrderFulfillmentStatus } from '../../../../shared/adminOrder'
import { isOrderFulfillmentStatus, transitionOrder } from '../../../services/orderTransitions'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database, email } = await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  const body = await readBody<{ fulfillmentStatus?: unknown; note?: unknown }>(event)
  if (
    !id ||
    !isOrderFulfillmentStatus(body?.fulfillmentStatus) ||
    (body.note !== undefined && typeof body.note !== 'string')
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a valid order status.' })
  }
  try {
    return await transitionOrder(
      database,
      id,
      body.fulfillmentStatus as OrderFulfillmentStatus,
      email,
      body.note as string | undefined,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ORDER_TRANSITION_CONFLICT'
    const statusCode =
      message === 'ORDER_NOT_FOUND' ? 404 : message === 'ORDER_INVALID_INPUT' ? 400 : 409
    const statusMessage =
      statusCode === 404
        ? 'Order not found.'
        : statusCode === 400
          ? 'Choose a valid order status.'
          : 'The order status changed. Refresh and try again.'
    throw createError({ statusCode, statusMessage })
  }
})
