import type { CartSnapshotInput } from '../../../shared/abandonedCart'
import { saveCartSnapshot } from '../../services/abandonedCarts'
import { getDatabase } from '../../utils/d1'
import { enforceRateLimit } from '../../utils/rateLimit'
import { requireJsonBody } from '../../utils/requestGuards'

export default defineEventHandler(async (event) => {
  const database = getDatabase(event)
  if (!database) return { tracked: false }
  await enforceRateLimit(event, 'cart-snapshot', 120, 10 * 60)
  const input = await requireJsonBody<CartSnapshotInput>(event, 16_384)
  try {
    return await saveCartSnapshot(database, input)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Cart could not be tracked.' })
  }
})
