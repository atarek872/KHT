import { requireCustomer, accountBody } from '../../utils/customerAuth'
import { writeSavedCart } from '../../services/customerCarts'

export default defineEventHandler(async (event) => {
  const body = await accountBody(event)
  const { user, database } = await requireCustomer(event)
  try {
    return await writeSavedCart(
      database,
      { user },
      { id: String(body.id || ''), version: Number(body.version), items: body.items },
    )
  } catch (error) {
    throw createError({
      statusCode: 409,
      statusMessage: String(error).includes('CART_CHANGED')
        ? 'Your bag changed on another device. Reload it before editing.'
        : error instanceof Error
          ? error.message
          : 'Your bag could not be saved.',
    })
  }
})
