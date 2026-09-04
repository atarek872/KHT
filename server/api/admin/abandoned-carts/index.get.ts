import { listAbandonedCarts } from '../../../services/abandonedCarts'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => ({
  items: await listAbandonedCarts((await requireAdmin(event)).database),
}))