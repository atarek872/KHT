import { deleteInventoryVariant } from '../../../services/inventory'
import { requireAdmin } from '../../../utils/adminAuth'
import { requireSameOrigin } from '../../../utils/requestGuards'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  requireSameOrigin(event)
  const id = getRouterParam(event, 'id') || ''
  if (!id.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a valid inventory variant.' })
  }

  try {
    return await deleteInventoryVariant(database, id)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'VARIANT_DELETE_CONFLICT'
    throw createError({
      statusCode: code === 'VARIANT_NOT_FOUND' ? 404 : code === 'VARIANT_DELETE_INVALID' ? 400 : 409,
      statusMessage:
        code === 'VARIANT_DELETE_CONFLICT'
          ? 'This variant appears in order history and cannot be deleted.'
          : code === 'VARIANT_NOT_FOUND'
            ? 'Inventory variant not found.'
            : 'Choose a valid inventory variant.',
    })
  }
})
