import { requireDatabase } from '../../utils/d1'
import { enforceRateLimit } from '../../utils/rateLimit'
import { requireJsonBody, requireSameOrigin } from '../../utils/requestGuards'
import { unsubscribeRecovery } from '../../services/cartRecoveryEmails'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  await enforceRateLimit(event, 'marketing-unsubscribe', 30, 10 * 60)
  const body = await requireJsonBody<{ token?: unknown }>(event, 2048)
  const saved = typeof body.token === 'string'
    ? await unsubscribeRecovery(requireDatabase(event), body.token)
    : false
  return { saved }
})
