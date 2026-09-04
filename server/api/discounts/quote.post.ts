import { calculateOrderTotal, priceOrder } from '../../../shared/order'
import { getCatalog } from '../../services/catalog'
import { quoteDiscount } from '../../services/discounts'
import { getDatabase, requireDatabase } from '../../utils/d1'
import { getStorefrontShippingRate } from '../../services/shipping'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  try {
    const database = requireDatabase(event)
    const zone = await getStorefrontShippingRate(database, String(body?.shippingGovernorate || ''))
    const priced = priceOrder(body?.items, await getCatalog(getDatabase(event)), zone.rate)
    const coupon = await quoteDiscount(database, priced.subtotal, body?.code)
    return { subtotal: priced.subtotal, shipping: priced.shipping, discount: coupon.discount,
      total: calculateOrderTotal(priced.subtotal, coupon.discount, priced.shipping),
      couponCode: coupon.coupon?.code }
  } catch (error) {
    throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Coupon could not be applied.' })
  }
})