import { getCustomer } from '../../utils/customerAuth'
import { requireDatabase } from '../../utils/d1'
import { enforceRateLimit } from '../../utils/rateLimit'
import { requireJsonBody, requireSameOrigin } from '../../utils/requestGuards'
import { setCartRecoveryConsent } from '../../services/cartRecoveryEmails'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  await enforceRateLimit(event, 'cart-recovery-consent', 20, 10 * 60)
  const body = await requireJsonBody<{ consent?: unknown; email?: unknown }>(event, 2048)
  if (typeof body.consent !== 'boolean' || typeof body.email !== 'string')
    throw createError({ statusCode: 400, statusMessage: 'Review your email preference.' })
  const user = await getCustomer(event)
  const database = requireDatabase(event)
  const email = user?.email || body.email
  let cartId: string | undefined
  if (user) {
    const row = await database.prepare(
      "SELECT id FROM abandoned_carts WHERE user_id=? AND state='active' ORDER BY created_at DESC LIMIT 1",
    ).bind(user.id).first<{ id: string }>()
    cartId = row?.id
  } else {
    const cookie = getCookie(event, 'kht-cart-id')
    if (/^[a-f0-9-]{36}$/i.test(cookie || '')) cartId = cookie
  }
  if (!cartId) throw createError({ statusCode: 409, statusMessage: 'Save your bag first.' })
  try {
    return await setCartRecoveryConsent(database, cartId, email, body.consent)
  } catch {
    throw createError({ statusCode: 409, statusMessage: 'Review your bag email and try again.' })
  }
})
