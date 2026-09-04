import { listProducts } from '../../../services/adminProducts'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => listProducts((await requireAdmin(event)).database))