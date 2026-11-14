import { recoveryMailConfigured } from '../../services/cartRecoveryEmails'

export default defineEventHandler((event) => {
  const env = (event.context.cloudflare as { env?: Record<string, string> } | undefined)?.env || {}
  setHeader(event, 'Cache-Control', 'public, max-age=60')
  return { enabled: recoveryMailConfigured(env) }
})
