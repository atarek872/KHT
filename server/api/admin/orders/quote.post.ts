import type { CreateOrderInput } from '../../../../shared/createOrder'
import { quoteOrder } from '../../../services/createOrder'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  try {
    const quote = await quoteOrder(database, await readBody<CreateOrderInput>(event))
    return { subtotal: quote.subtotal, shipping: quote.shipping, discount: quote.discount,
      total: quote.total, couponCode: quote.couponCode }
  } catch (error) {
    throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Order could not be quoted.' })
  }
})