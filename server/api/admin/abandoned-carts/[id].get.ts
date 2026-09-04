import { getAbandonedCart } from '../../../services/abandonedCarts'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  const cart = await getAbandonedCart(database, getRouterParam(event, 'id') || '')
  if (!cart) throw createError({ statusCode: 404, statusMessage: 'Cart not found.' })
  return cart
})