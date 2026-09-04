import { listDiscounts } from '../../../services/discounts'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => listDiscounts((await requireAdmin(event)).database))