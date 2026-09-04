import { duplicateProduct } from '../../../../services/adminProducts'
import { requireAdmin } from '../../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  return duplicateProduct(database, getRouterParam(event, 'id') || '')
})