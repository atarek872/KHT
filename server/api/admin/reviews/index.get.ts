import { adminProductReviews } from '../../../services/productReviews'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  return adminProductReviews(database)
})
