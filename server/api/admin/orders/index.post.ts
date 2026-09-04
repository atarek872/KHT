import type { CreateOrderInput } from '../../../../shared/createOrder'
import { createOrder } from '../../../services/createOrder'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  const body = await readBody<CreateOrderInput>(event)
  try {
    return { order: await createOrder(database, body) }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Order could not be created.'
    const conflict = /STOCK|VARIANT|DUPLICATE/.test(message)
    throw createError({ statusCode: conflict ? 409 : 400, statusMessage: message })
  }
})