import { calculateOrderTotal, priceOrder } from '../../shared/order'
import { getCatalog } from '../services/catalog'
import { getDatabase } from '../utils/d1'
import { quoteDiscount } from '../services/discounts'
import { requireDatabase } from '../utils/d1'
import { getStorefrontShippingRate } from '../services/shipping'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (body?.demoAcknowledged !== true)
    throw createError({
      statusCode: 400,
      statusMessage: 'This checkout is a demonstration. Acknowledge demo mode to continue.',
    })
  // No customer details or payment information are collected by this endpoint.
  // It validates a demo quote; it does not create or fulfill a commercial order.
  try {
    const catalog = await getCatalog(getDatabase(event))
    const database = getDatabase(event)
    const zone = await getStorefrontShippingRate(database, String(body?.shippingGovernorate || ''))
    const priced = priceOrder(body.items, catalog, zone.rate)
    const coupon = body?.couponCode
      ? await quoteDiscount(requireDatabase(event), priced.subtotal, body.couponCode)
      : { discount: 0, coupon: null }
    return {
      ...priced,
      discount: coupon.discount,
      total: calculateOrderTotal(priced.subtotal, coupon.discount, priced.shipping),
      couponCode: coupon.coupon?.code,
      reference: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      demo: true as const,
    }
  } catch (error) {
    throw createError({
      statusCode: 409,
      statusMessage: error instanceof Error ? error.message : 'Review your bag and try again.',
    })
  }
})
