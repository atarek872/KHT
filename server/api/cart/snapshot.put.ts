import type { CartSnapshotInput } from '../../../shared/abandonedCart'
import { saveCartSnapshot } from '../../services/abandonedCarts'
import { getDatabase } from '../../utils/d1'

export default defineEventHandler(async (event) => {
  const database = getDatabase(event)
  if (!database) return { tracked: false }
  try {
    return await saveCartSnapshot(database, await readBody<CartSnapshotInput>(event))
  } catch (error) {
    throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Cart could not be tracked.' })
  }
})