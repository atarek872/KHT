import { getShippingZone } from '../../../services/shipping'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  const zone = await getShippingZone(database, getRouterParam(event, 'governorate') || '')
  if (!zone) throw createError({ statusCode: 404, statusMessage: 'Shipping zone not found.' })
  return zone
})