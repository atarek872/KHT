import { requireAdmin } from '../../../../utils/adminAuth'
import { requireJsonBody, requireSameOrigin } from '../../../../utils/requestGuards'
import { deliverRecoveryEmails } from '../../../../services/cartRecoveryEmails'
import {
  loadRecoveryMailConfig,
  queueManualRecovery,
} from '../../../../services/recoveryAdminSettings'

export default defineEventHandler(async (event) => {
  const { database, email } = await requireAdmin(event)
  requireSameOrigin(event)
  const id = getRouterParam(event, 'id') || ''
  const body = await requireJsonBody<{ consentSource?: unknown }>(event, 2048)
  if (body?.consentSource !== undefined && typeof body.consentSource !== 'string')
    throw createError({
      statusCode: 400,
      statusMessage: 'Enter where the customer gave permission.',
    })
  const env = (event.context.cloudflare as { env?: Record<string, string> } | undefined)?.env || {}
  const config = await loadRecoveryMailConfig(database, String(env.RECOVERY_SETTINGS_KEY || ''))
  if (!config.BREVO_API_KEY)
    throw createError({
      statusCode: 409,
      statusMessage: 'Enable Brevo cart recovery in Settings first.',
    })
  try {
    await queueManualRecovery(database, id, email, body?.consentSource as string | undefined)
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    throw createError({
      statusCode: code === 'NOT_ACTIVE' ? 404 : 409,
      statusMessage:
        (
          {
            CONSENT_REQUIRED: 'Record where the customer agreed to receive this reminder.',
            UNSUBSCRIBED: 'This customer unsubscribed from reminder emails.',
            ALREADY_QUEUED: 'A reminder has already been queued for this cart.',
            EMAIL_REQUIRED: 'This cart has no valid email address.',
            NOT_ACTIVE: 'This cart is no longer active.',
          } as Record<string, string>
        )[code] || 'Could not queue the reminder.',
    })
  }
  const delivery = await deliverRecoveryEmails(database, config, fetch, 1, id)
  return { accepted: delivery.sent === 1, queued: delivery.sent !== 1 }
})
