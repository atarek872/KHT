import { getProduct } from '../../../services/adminProducts'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  const product = await getProduct(database, getRouterParam(event, 'id') || '')
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Product not found.' })
  return product
})