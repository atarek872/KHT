import { archiveProduct } from '../../../../services/adminProducts'
import { requireAdmin } from '../../../../utils/adminAuth'
import { requireSameOrigin } from '../../../../utils/requestGuards'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  requireSameOrigin(event)
  await archiveProduct(database, getRouterParam(event, 'id') || '')
  return { archived: true }
})
