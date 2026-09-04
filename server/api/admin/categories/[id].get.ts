import { getCategory } from '../../../services/adminCategories'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  const category = await getCategory(database, getRouterParam(event, 'id') || '')
  if (!category) throw createError({ statusCode: 404, statusMessage: 'Category not found.' })
  return category
})