import type { StorefrontCheckoutInput } from '../../shared/storefrontOrder.ts'
import { createStorefrontOrder } from '../services/storefrontCheckout.ts'
import { requireDatabase } from '../utils/d1.ts'

export default defineEventHandler(async (event) => {
  const database = requireDatabase(event)
  const input = await readBody<StorefrontCheckoutInput>(event)
  try {
    return await createStorefrontOrder(database, input)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Review your bag and try again.'
    const conflict = /STOCK|VARIANT|available|coupon|DISCOUNT/i.test(message)
    throw createError({ statusCode: conflict ? 409 : 400, statusMessage: message })
  }
})
