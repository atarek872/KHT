import { getProductMedia } from '../../utils/d1'

export default defineEventHandler(async (event) => {
  const bucket = getProductMedia(event)
  const key = getRouterParam(event, 'key') || ''
  if (!bucket || !key.match(/^[a-f0-9-]+\.(?:jpg|png|webp)$/)) throw createError({ statusCode: 404 })
  const object = await bucket.get(key)
  if (!object) throw createError({ statusCode: 404 })
  return new Response(object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType || 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
      etag: object.etag || '',
    },
  })
})