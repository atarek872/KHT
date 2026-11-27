import { demoShippingZones, listShippingZones } from '../../services/shipping'
import { getDatabase } from '../../utils/d1'
import { getActiveStorePromotion } from '../../services/promotions'

export default defineEventHandler(async (event) => {
  const database = getDatabase(event)
  if (!database) return { items: demoShippingZones, freeShipping: false }
  const [zones, promotion] = await Promise.all([
    listShippingZones(database, true),
    getActiveStorePromotion(database),
  ])
  return {
    items: zones.map((zone) =>
      promotion.freeShipping ? { ...zone, standardRate: zone.rate, rate: 0 } : zone,
    ),
    freeShipping: promotion.freeShipping,
  }
})
