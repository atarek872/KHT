import { requireSameOrigin, destroyCustomerSession } from '../../utils/customerAuth'
export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  await destroyCustomerSession(event)
  deleteCookie(event, 'kht-guest-cart', { path: '/' })
  return { ok: true }
})
