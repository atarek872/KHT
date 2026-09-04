import type { ShippingZoneInput } from '../../../../shared/shipping'
import { createShippingZone } from '../../../services/shipping'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  try { return await createShippingZone(database, await readBody<ShippingZoneInput>(event)) }
  catch (error) { throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Shipping zone could not be created.' }) }
})