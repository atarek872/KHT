import { getOrderConfirmation } from '../../services/storefrontOrders.ts'
import { requireDatabase } from '../../utils/d1.ts'

export default defineEventHandler(async (event) => {
  const reference = getRouterParam(event, 'reference') || ''
  const order = await getOrderConfirmation(requireDatabase(event), reference)
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })
  return order
})
