import type { AdminProductInput } from '../../../../shared/adminProduct'
import { saveProduct } from '../../../services/adminProducts'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  try { return await saveProduct(database, await readBody<AdminProductInput>(event)) }
  catch (error) { throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Product could not be created.' }) }
})