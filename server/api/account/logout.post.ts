import { requireCustomerOrigin, destroyCustomerSession } from '../../utils/customerAuth'
export default defineEventHandler(async (event) => {
  requireCustomerOrigin(event)
  await destroyCustomerSession(event)
  deleteCookie(event, 'kht-guest-cart', { path: '/' })
  return { ok: true }
})
