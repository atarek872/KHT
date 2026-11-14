import { getRecoverySelections } from '../../services/cartRecoveryEmails'
import { requireDatabase } from '../../utils/d1'
import { enforceRateLimit } from '../../utils/rateLimit'
import { requireJsonBody, requireSameOrigin } from '../../utils/requestGuards'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  setHeader(event, 'Cache-Control', 'private, no-store')
  await enforceRateLimit(event, 'cart-recover', 30, 10 * 60)
  const body = await requireJsonBody<{ token?: unknown }>(event, 2048)
  const token = body.token
  if (typeof token !== 'string' || !/^[a-f0-9-]{72}$/i.test(token))
    throw createError({ statusCode: 404, statusMessage: 'Recovery link is unavailable.' })
  const items = await getRecoverySelections(requireDatabase(event), token)
  if (!items) throw createError({ statusCode: 404, statusMessage: 'Recovery link is unavailable.' })
  return { items }
})
