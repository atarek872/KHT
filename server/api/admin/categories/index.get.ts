import { listCategories } from '../../../services/adminCategories'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => listCategories((await requireAdmin(event)).database))