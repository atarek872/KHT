import { requireAdmin } from '../../utils/adminAuth'
import { getProductMedia } from '../../utils/d1'

const allowed = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const bucket = getProductMedia(event)
  if (!bucket) throw createError({ statusCode: 503, statusMessage: 'Product media storage is not configured.' })
  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'image')
  const extension = file?.type ? allowed.get(file.type) : undefined
  if (!file?.data || !extension) throw createError({ statusCode: 400, statusMessage: 'Upload a JPG, PNG, or WebP image.' })
  if (file.data.byteLength > 5 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Product images must be 5 MB or smaller.' })
  const key = `${crypto.randomUUID()}.${extension}`
  await bucket.put(key, file.data, { httpMetadata: { contentType: file.type } })
  return { url: `/api/media/${key}` }
})