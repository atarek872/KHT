import { deleteCategory } from '../../../services/adminCategories'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  try {
    await deleteCategory(database, getRouterParam(event, 'id') || '')
    return { deleted: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Category could not be deleted.'
    throw createError({
      statusCode: message === 'CATEGORY_IN_USE' ? 409 : message === 'CATEGORY_NOT_FOUND' ? 404 : 400,
      statusMessage: message === 'CATEGORY_IN_USE' ? 'Move or archive products before deleting this category.' : message,
    })
  }
})