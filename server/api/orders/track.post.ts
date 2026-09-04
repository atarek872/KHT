import { trackOrder } from '../../services/storefrontOrders.ts'
import { requireDatabase } from '../../utils/d1.ts'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ reference?: string; phone?: string }>(event)
  const order = await trackOrder(
    requireDatabase(event),
    String(body?.reference || ''),
    String(body?.phone || ''),
  )
  if (!order) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No order matches that reference and phone number.',
    })
  }
  return order
})
