import { getCustomer } from '../../utils/customerAuth'
import { requireDatabase } from '../../utils/d1'
import { hasCartRecoveryConsent } from '../../services/cartRecoveryEmails'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const user = await getCustomer(event)
  const database = requireDatabase(event)
  const email = user?.email || getQuery(event).email
  if (typeof email !== 'string') return { consented: false }
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
  return { consented: cartId ? await hasCartRecoveryConsent(database, cartId, email) : false }
})
