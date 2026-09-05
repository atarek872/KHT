import type { AdminProductInput } from '../../../../shared/adminProduct'
import { saveProduct } from '../../../services/adminProducts'
import { requireAdmin } from '../../../utils/adminAuth'
import { getProduct } from '../../../services/adminProducts'
import { getProductMedia } from '../../../utils/d1'
import { isMediaReferenced } from '../../../services/mediaReferences'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  const previous = await getProduct(database, id)
  let saved
  try {
    saved = await saveProduct(database, await readBody<AdminProductInput>(event), id)
  }
  catch (error) { throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Product could not be saved.' }) }
  const bucket = getProductMedia(event)
  const removedUrls = (previous?.images || []).filter((url) => !saved.images.includes(url))
  for (const url of removedUrls) {
    const key = url.match(/^\/api\/media\/([a-f0-9-]+\.(?:jpg|png|webp))$/)?.[1]
    if (bucket && key && !(await isMediaReferenced(database, url))) await bucket.delete(key)
  }
  return saved
})
