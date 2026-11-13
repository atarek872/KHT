import { deliverMetaOutbox, metaConfiguration } from '../services/metaCapi.ts'
import { deliverGa4Outbox } from '../services/ga4Purchase.ts'
import type { D1Database } from '../utils/d1.ts'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:scheduled', async (payload: unknown) => {
    const env = (payload as { env?: Record<string, unknown> }).env
    const database = env?.DB as D1Database | undefined
    if (!database) return
    await deliverMetaOutbox(database, metaConfiguration(env))
    await deliverGa4Outbox(database, {
      measurementId: String(env?.NUXT_PUBLIC_GOOGLE_TAG_ID || ''),
      apiSecret: String(env?.GA4_API_SECRET || ''),
    })
  })
})
