import type { DiscountInput } from '../../../../shared/discount'
import { saveDiscount } from '../../../services/discounts'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  try { return await saveDiscount(database, await readBody<DiscountInput>(event), getRouterParam(event, 'id') || '') }
  catch (error) { throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Discount could not be saved.' }) }
})