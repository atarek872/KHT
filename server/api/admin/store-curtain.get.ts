import { getStoreCurtain } from '../../services/storeCurtain'
import { requireAdmin } from '../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  return getStoreCurtain(database)
})
