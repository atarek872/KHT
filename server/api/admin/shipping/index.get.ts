import { listShippingZones } from '../../../services/shipping'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => ({
  items: await listShippingZones((await requireAdmin(event)).database),
}))