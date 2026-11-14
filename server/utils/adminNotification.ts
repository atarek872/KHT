import type { H3Event } from 'h3'
import { deliverAdminNotifications, queueOrderNotification, type AdminEmailConfig } from '../services/adminEmailNotifications.ts'
import type { D1Database } from './d1.ts'

interface CloudflareMailContext {
  env?: AdminEmailConfig
  context?: { waitUntil(promise: Promise<unknown>): void }
}

export function scheduleAdminOrderNotification(
  event: H3Event,
  database: D1Database,
  order: { id?: string; reference?: string },
) {
  const cloudflare = event.context.cloudflare as CloudflareMailContext | undefined
  if (!cloudflare?.context?.waitUntil) return
  cloudflare.context.waitUntil((async () => {
    let id = order.id
    if (!id && order.reference) {
      const found = await database.prepare(
        'SELECT id FROM orders WHERE public_reference = ?',
      ).bind(order.reference).first<{ id: string }>()
      id = found?.id
    }
    if (!id) return
    await queueOrderNotification(database, id)
    await deliverAdminNotifications(database, cloudflare.env || {}, 1)
  })().catch(() => {
    console.warn('KHT admin order alert could not start')
  }))
}
