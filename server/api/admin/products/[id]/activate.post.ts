import { activateProduct } from '../../../../services/adminProducts'
import { requireAdmin } from '../../../../utils/adminAuth'
import { requireSameOrigin } from '../../../../utils/requestGuards'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  requireSameOrigin(event)
  const id = getRouterParam(event, 'id') || ''
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid product.' })
  try {
    return await activateProduct(database, id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PRODUCT_NOT_FOUND'
    if (message === 'PRODUCT_NOT_FOUND') {
      throw createError({ statusCode: 404, statusMessage: 'Product not found.' })
    }
    if (message === 'PRODUCT_REACTIVATION_REQUIRES_ACTIVE_VARIANT') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Edit the product and enable at least one variant before reactivating it.',
      })
    }
    throw createError({ statusCode: 400, statusMessage: 'The product could not be reactivated.' })
  }
})
