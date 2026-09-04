import { demoShippingZones, listShippingZones } from '../../services/shipping'
import { getDatabase } from '../../utils/d1'

export default defineEventHandler(async (event) => {
  const database = getDatabase(event)
  return { items: database ? await listShippingZones(database, true) : demoShippingZones }
})