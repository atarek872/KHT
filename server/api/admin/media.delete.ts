import { requireAdmin } from '../../utils/adminAuth'
import { getProductMedia } from '../../utils/d1'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  const bucket = getProductMedia(event)
  const url = String(getQuery(event).url || '')
  const key = url.match(/^\/api\/media\/([a-f0-9-]+\.(?:jpg|png|webp))$/)?.[1]
  if (!bucket || !key) throw createError({ statusCode: 400, statusMessage: 'Invalid product image.' })
  const reference = await database.prepare(`SELECT id FROM products WHERE image = ?
    UNION ALL SELECT id FROM categories WHERE image = ? LIMIT 1`).bind(url, url).first()
  if (reference) throw createError({ statusCode: 409, statusMessage: 'This image is still used by a product.' })
  await bucket.delete(key)
  return { deleted: true }
})