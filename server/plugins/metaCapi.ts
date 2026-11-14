import { deliverMetaOutbox, metaConfiguration } from '../services/metaCapi.ts'
import { deliverGa4Outbox } from '../services/ga4Purchase.ts'
import {
  captureAdminNotifications,
  deliverAdminNotifications,
} from '../services/adminEmailNotifications.ts'
import { captureRecoveryEmails, deliverRecoveryEmails } from '../services/cartRecoveryEmails.ts'
import { loadRecoveryMailConfig } from '../services/recoveryAdminSettings.ts'
import type { D1Database } from '../utils/d1.ts'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:scheduled', async (payload: unknown) => {
    const env = (payload as { env?: Record<string, unknown> }).env
    const database = env?.DB as D1Database | undefined
    if (!database) return
    const jobs = await Promise.allSettled([
      deliverMetaOutbox(database, metaConfiguration(env)),
      deliverGa4Outbox(database, {
        measurementId: String(env?.NUXT_PUBLIC_GOOGLE_TAG_ID || ''),
        apiSecret: String(env?.GA4_API_SECRET || ''),
      }),
      (async () => {
        await captureAdminNotifications(database)
        await deliverAdminNotifications(database, env || {})
      })(),
      (async () => {
        const config = await loadRecoveryMailConfig(
          database,
          String(env?.RECOVERY_SETTINGS_KEY || ''),
        )
        if (config.BREVO_API_KEY) {
          await captureRecoveryEmails(database, config.firstDelayMinutes, config.secondDelayHours)
          await deliverRecoveryEmails(database, config)
        }
      })(),
    ])
    jobs.forEach((job, index) => {
      if (job.status === 'rejected')
        console.warn('KHT scheduled delivery failed', {
          job: ['meta', 'ga4', 'admin-email', 'cart-recovery'][index],
        })
    })
  })
})
