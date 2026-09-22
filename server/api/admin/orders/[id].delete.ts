import { deleteAdminOrder } from '../../../services/adminOrders'
import { requireAdmin } from '../../../utils/adminAuth'
import { requireJsonBody, requireSameOrigin } from '../../../utils/requestGuards'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  requireSameOrigin(event)
  const id = getRouterParam(event, 'id') || ''
  const body = await requireJsonBody<{ orderNumber?: unknown }>(event, 1_024)
  if (!id.trim() || typeof body.orderNumber !== 'string' || !body.orderNumber.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Enter the exact order number.' })
  }
  try {
    return await deleteAdminOrder(database, id, body.orderNumber)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'ORDER_DELETE_CONFLICT'
    throw createError({
      statusCode: code === 'ORDER_NOT_FOUND' ? 404 : code === 'ORDER_DELETE_INVALID' ? 400 : 409,
      statusMessage:
        code === 'ORDER_NOT_FOUND'
          ? 'Order not found.'
          : code === 'ORDER_DELETE_INVALID'
            ? 'Enter the exact order number.'
            : 'This order cannot be deleted. Refresh and check its current fulfillment state.',
    })
  }
})
