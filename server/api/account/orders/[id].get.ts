import { requireCustomer } from '../../../utils/customerAuth'
import { getCustomerOrder } from '../../../services/customerOrders'
export default defineEventHandler(async (event) => {
  const { user, database } = await requireCustomer(event)
  const order = await getCustomerOrder(database, user.id, getRouterParam(event, 'id') || '')
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })
  return { order }
})
