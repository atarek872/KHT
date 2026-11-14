import type { CreateOrderInput } from '../../../../shared/createOrder'
import { createOrder } from '../../../services/createOrder'
import { requireAdmin } from '../../../utils/adminAuth'
import { scheduleAdminOrderNotification } from '../../../utils/adminNotification'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  const body = await readBody<CreateOrderInput>(event)
  try {
    const order = await createOrder(database, body)
    scheduleAdminOrderNotification(event, database, { id: order.id })
    return { order }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Order could not be created.'
    const conflict = /STOCK|VARIANT|DUPLICATE/.test(message)
    throw createError({ statusCode: conflict ? 409 : 400, statusMessage: message })
  }
})
