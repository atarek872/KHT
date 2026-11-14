import { requireAdmin } from '../../../utils/adminAuth'
import { requireJsonBody, requireSameOrigin } from '../../../utils/requestGuards'
import {
  saveRecoveryAdminSettings,
  type RecoveryCopy,
} from '../../../services/recoveryAdminSettings'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  requireSameOrigin(event)
  const body = await requireJsonBody<{
    enabled: boolean
    senderEmail: string
    credential?: string
    firstDelayMinutes: number
    secondDelayHours: number
    copy: RecoveryCopy
  }>(event, 16_384)
  const secret = String(
    (event.context.cloudflare as { env?: Record<string, string> } | undefined)?.env
      ?.RECOVERY_SETTINGS_KEY || '',
  )
  if (!secret)
    throw createError({ statusCode: 503, statusMessage: 'Encryption is not configured yet.' })
  try {
    return await saveRecoveryAdminSettings(database, secret, { ...body, apiKey: body.credential })
  } catch (error) {
    if (
      (error instanceof Error && error.message.startsWith('INVALID_')) ||
      (error instanceof Error && error.message === 'CONFIGURATION_REQUIRED')
    )
      throw createError({
        statusCode: 400,
        statusMessage: 'Check the email, timing, message text and Brevo API key before saving.',
      })
    throw error
  }
})
