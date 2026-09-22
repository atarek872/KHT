import { deleteAbandonedCart } from '../../../services/abandonedCarts'
import { requireAdmin } from '../../../utils/adminAuth'
import { requireSameOrigin } from '../../../utils/requestGuards'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  requireSameOrigin(event)
  const id = getRouterParam(event, 'id') || ''
  if (!id.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a valid abandoned cart.' })
  }
  try {
    return await deleteAbandonedCart(database, id)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'CART_DELETE_CONFLICT'
    throw createError({
      statusCode: code === 'CART_NOT_FOUND' ? 404 : code === 'CART_DELETE_INVALID' ? 400 : 409,
      statusMessage:
        code === 'CART_NOT_FOUND'
          ? 'Cart not found.'
          : code === 'CART_DELETE_INVALID'
            ? 'Choose a valid abandoned cart.'
            : 'This cart belongs to an order and cannot be deleted.',
    })
  }
})
