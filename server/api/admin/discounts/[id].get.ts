import { getDiscount } from '../../../services/discounts'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  const discount = await getDiscount(database, getRouterParam(event, 'id') || '')
  if (!discount) throw createError({ statusCode: 404, statusMessage: 'Discount not found.' })
  return discount
})