import type { AdminCategoryInput } from '../../../../shared/adminCategory'
import { saveCategory } from '../../../services/adminCategories'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  try { return await saveCategory(database, await readBody<AdminCategoryInput>(event)) }
  catch (error) { throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Category could not be created.' }) }
})