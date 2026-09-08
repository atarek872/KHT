import type { CartSnapshotInput } from '../../../shared/abandonedCart'
import { getSavedCart, writeSavedCart } from '../../services/customerCarts'
import { getDatabase } from '../../utils/d1'
import { getCustomer, requireSameOrigin } from '../../utils/customerAuth'
import { guestCartHash } from '../../utils/cartIdentity'

export default defineEventHandler(async (event) => {
  const database = getDatabase(event)
  if (!database) return { tracked: false }
  requireSameOrigin(event)
  // Browser cart IDs are never authorization. The guest key is server-issued and HttpOnly.
  if (await getCustomer(event))
    throw createError({ statusCode: 409, statusMessage: 'Reload your account bag before editing.' })
  try {
    const body = await readBody<CartSnapshotInput>(event)
    const owner = { guestHash: await guestCartHash(event) }
    const cart = await getSavedCart(database, owner)
    await writeSavedCart(database, owner, { ...cart, items: body?.items })
    return { tracked: true }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Cart could not be tracked.',
    })
  }
})
