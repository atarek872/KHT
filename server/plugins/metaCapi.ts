import { deliverMetaOutbox, metaConfiguration } from '../services/metaCapi.ts'
import { deliverGa4Outbox } from '../services/ga4Purchase.ts'
import { captureAdminNotifications, deliverAdminNotifications } from '../services/adminEmailNotifications.ts'
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
    ])
    jobs.forEach((job, index) => {
      if (job.status === 'rejected')
        console.warn('KHT scheduled delivery failed', { job: ['meta', 'ga4', 'admin-email'][index] })
    })
  })
})
