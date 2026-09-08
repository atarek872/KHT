import { getCustomer } from '../../utils/customerAuth'
import { requireDatabase } from '../../utils/d1'
import { guestCartHash } from '../../utils/cartIdentity'
import { getCustomerOrder } from '../../services/customerOrders'
export default defineEventHandler(async (event) => {
  const user = await getCustomer(event)
  const order = await getCustomerOrder(
    requireDatabase(event),
    user?.id || null,
    getRouterParam(event, 'id') || '',
    await guestCartHash(event),
  )
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })
  return { order }
})
