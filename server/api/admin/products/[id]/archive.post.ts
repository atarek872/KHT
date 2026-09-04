import { archiveProduct } from '../../../../services/adminProducts'
import { requireAdmin } from '../../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  await archiveProduct(database, getRouterParam(event, 'id') || '')
  return { archived: true }
})