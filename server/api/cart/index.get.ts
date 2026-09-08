import { getCustomer } from '../../utils/customerAuth'
import { getSavedCart } from '../../services/customerCarts'
import { requireDatabase } from '../../utils/d1'
import { guestCartHash } from '../../utils/cartIdentity'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const user = await getCustomer(event)
  return getSavedCart(
    requireDatabase(event),
    user ? { user } : { guestHash: await guestCartHash(event) },
  )
})
