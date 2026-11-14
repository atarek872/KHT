import { requireAdmin } from '../../../utils/adminAuth'
import { requireSameOrigin } from '../../../utils/requestGuards'
import { loadRecoveryMailConfig } from '../../../services/recoveryAdminSettings'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  requireSameOrigin(event)
  const env = (event.context.cloudflare as { env?: Record<string, string> } | undefined)?.env || {}
  const config = await loadRecoveryMailConfig(
    database,
    String(env.RECOVERY_SETTINGS_KEY || ''),
    true,
  )
  if (!config.BREVO_API_KEY || !config.BREVO_SENDER_EMAIL)
    throw createError({
      statusCode: 400,
      statusMessage: 'Save your Brevo API key and verified sender first.',
    })
  const destination = String(env.ADMIN_ALERT_EMAIL || '')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination))
    throw createError({
      statusCode: 503,
      statusMessage: 'Admin test destination is not configured.',
    })
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': config.BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { email: config.BREVO_SENDER_EMAIL, name: 'KHT' },
        to: [{ email: destination }],
        subject: 'KHT cart recovery · Brevo test',
        textContent: 'Brevo is connected to KHT. This is a test email / رسالة اختبار من KHT.',
        tags: ['cart-recovery-test'],
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error('Brevo rejected test email')
    return { accepted: true }
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'Brevo did not accept the test. Check the API key and sender verification.',
    })
  }
})
