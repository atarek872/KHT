import { calculateOrderTotal, priceOrder } from '../../../shared/order'
import { getCatalog } from '../../services/catalog'
import { quoteDiscount } from '../../services/discounts'
import { getDatabase, requireDatabase } from '../../utils/d1'
import { getStorefrontShippingRate } from '../../services/shipping'
import { enforceRateLimit } from '../../utils/rateLimit'
import { requireJsonBody, safeErrorMessage } from '../../utils/requestGuards'
import { getCustomer } from '../../utils/customerAuth'
import { resolveCustomerDiscountCode, WELCOME_DISCOUNT_CODE } from '../../services/welcomeOffer'

export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'discount-quote', 60, 10 * 60)
  const body = await requireJsonBody<{
    code?: unknown
    shippingGovernorate?: unknown
    items?: unknown
  }>(event, 16_384)
  try {
    const database = requireDatabase(event)
    const user = await getCustomer(event)
    const zone = await getStorefrontShippingRate(database, String(body?.shippingGovernorate || ''))
    const priced = priceOrder(
      body?.items,
      await getCatalog(getDatabase(event), import.meta.dev),
      zone.rate,
    )
    const discountCode = await resolveCustomerDiscountCode(database, {
      userId: user?.id,
      requestedCode: typeof body?.code === 'string' ? body.code : undefined,
      automaticWelcome: Boolean(user && !body?.code),
    })
    const coupon = await quoteDiscount(database, priced.subtotal, discountCode)
    return {
      subtotal: priced.subtotal,
      shipping: priced.shipping,
      discount: coupon.discount,
      total: calculateOrderTotal(priced.subtotal, coupon.discount, priced.shipping),
      couponCode: coupon.coupon?.code,
      promotion: coupon.coupon?.code === WELCOME_DISCOUNT_CODE ? 'welcome' : undefined,
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: safeErrorMessage(
        error,
        [
          /^Coupon code was not found\.$/,
          /^This coupon (?:is inactive|is not active yet|has expired|has reached its usage limit)\.$/,
          /^This coupon requires a minimum order of \d+ EGP\.$/,
          /^The welcome gift is available on your signed-in first order only\.$/,
          /^Shipping is not available for this governorate\.$/,
        ],
        'Coupon could not be applied.',
      ),
    })
  }
})
