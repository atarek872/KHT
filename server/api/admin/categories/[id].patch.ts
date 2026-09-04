import type { AdminCategoryInput } from '../../../../shared/adminCategory'
import { getCategory, saveCategory } from '../../../services/adminCategories'
import { requireAdmin } from '../../../utils/adminAuth'
import { getProductMedia } from '../../../utils/d1'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  const previous = await getCategory(database, id)
  try {
    const saved = await saveCategory(database, await readBody<AdminCategoryInput>(event), id)
    const oldKey = previous?.image.match(/^\/api\/media\/([a-f0-9-]+\.(?:jpg|png|webp))$/)?.[1]
    if (oldKey && previous?.image !== saved.image) await getProductMedia(event)?.delete(oldKey)
    return saved
  }
  catch (error) { throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Category could not be saved.' }) }
})