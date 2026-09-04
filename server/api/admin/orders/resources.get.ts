import { getCreateOrderResources } from '../../../services/createOrder'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  return getCreateOrderResources(database)
})