import type { ShippingZoneInput } from '../../../../shared/shipping'
import { updateShippingZone } from '../../../services/shipping'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  try {
    return await updateShippingZone(database, getRouterParam(event, 'governorate') || '',
      await readBody<ShippingZoneInput>(event))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Shipping zone could not be saved.'
    throw createError({ statusCode: message === 'SHIPPING_ZONE_NOT_FOUND' ? 404 : 400, statusMessage: message })
  }
})