import { getAdminStoreContent } from '../../services/storeContent'
import { requireAdmin } from '../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  return getAdminStoreContent(database)
})
