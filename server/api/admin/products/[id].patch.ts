import type { AdminProductInput } from '../../../../shared/adminProduct'
import { saveProduct } from '../../../services/adminProducts'
import { requireAdmin } from '../../../utils/adminAuth'
import { getProduct } from '../../../services/adminProducts'
import { getProductMedia } from '../../../utils/d1'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  const previous = await getProduct(database, id)
  try {
    const saved = await saveProduct(database, await readBody<AdminProductInput>(event), id)
    const oldKey = previous?.image.match(/^\/api\/media\/([a-f0-9-]+\.(?:jpg|png|webp))$/)?.[1]
    if (oldKey && previous?.image !== saved.image) await getProductMedia(event)?.delete(oldKey)
    return saved
  }
  catch (error) { throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Product could not be saved.' }) }
})