import { requireCustomer, accountBody } from '../../utils/customerAuth'
import { mergeGuestCart } from '../../services/customerCarts'
import { guestCartHash } from '../../utils/cartIdentity'

export default defineEventHandler(async (event) => {
  const body = await accountBody(event)
  const { user, database } = await requireCustomer(event)
  try {
    return await mergeGuestCart(database, user, await guestCartHash(event), body?.items)
  } catch (error) {
    throw createError({
      statusCode: 409,
      statusMessage: error instanceof Error ? error.message : 'Your guest bag could not be merged.',
    })
  }
})
