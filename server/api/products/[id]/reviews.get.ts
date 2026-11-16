import { publicProductReviews } from '../../../services/productReviews'
import { requireDatabase } from '../../../utils/d1'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') || ''
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id))
    throw createError({ statusCode: 400, statusMessage: 'Invalid product.' })
  setHeader(event, 'Cache-Control', 'public, max-age=60')
  return publicProductReviews(requireDatabase(event), id)
})
