import { updateInventory } from '../../../services/inventory'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  const body = await readBody<{ stock: number; expectedStock: number }>(event)
  try {
    return await updateInventory(database, getRouterParam(event, 'id') || '', body.stock, body.expectedStock)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Inventory could not be updated.'
    throw createError({
      statusCode: message === 'INVENTORY_CONFLICT' ? 409 : message === 'VARIANT_NOT_FOUND' ? 404 : 400,
      statusMessage: message === 'INVENTORY_CONFLICT' ? 'Stock changed elsewhere. Refresh and try again.' : message,
    })
  }
})