import type { D1Database } from '../utils/d1.ts'

const site = 'https://kht-eg.com'
const inactivityMinutes = 5

export interface AdminEmailConfig {
  ALERT_EMAIL?: {
    send(message: { to: string; from: string; subject: string; text: string }): Promise<unknown>
  }
  MAIL_FROM?: string
  ADMIN_ALERT_EMAIL?: string
}

interface NotificationRow {
  kind: 'order' | 'abandoned_cart'
  entityId: string
  attempts: number
}

export async function queueOrderNotification(database: D1Database, orderId: string) {
  const now = new Date().toISOString()
  await database.prepare(
    `INSERT OR IGNORE INTO admin_email_notifications
      (kind, entity_id, next_attempt_at, created_at)
     SELECT 'order', id, ?, ? FROM orders WHERE id = ?`,
  ).bind(now, now, orderId).run()
}

export async function captureAdminNotifications(database: D1Database) {
  const now = new Date().toISOString()
  await database.batch([
    database.prepare(
      `INSERT OR IGNORE INTO admin_email_notifications
        (kind, entity_id, next_attempt_at, created_at)
       SELECT 'order', id, ?, ? FROM orders`,
    ).bind(now, now),
    database.prepare(
      `INSERT OR IGNORE INTO admin_email_notifications
        (kind, entity_id, next_attempt_at, created_at)
       SELECT 'abandoned_cart', c.id, ?, ? FROM abandoned_carts c
       WHERE c.state = 'active' AND c.items_count > 0
         AND c.recovery_state IN ('active', 'contacted')
         AND datetime(c.last_activity) <= datetime('now', '-${inactivityMinutes} minutes')
         AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.cart_id = c.id)`,
    ).bind(now, now),
  ])
}

async function notificationMessage(database: D1Database, row: NotificationRow) {
  if (row.kind === 'order') {
    const order = await database.prepare(
      `SELECT number, total, source, created_at AS createdAt
       FROM orders WHERE id = ?`,
    ).bind(row.entityId).first<{
      number: string; total: number; source: string; createdAt: string
    }>()
    if (!order) return { status: 'skip' as const }
    return {
      status: 'send' as const,
      subject: `KHT | طلب جديد ${order.number}`,
      text: `تم تسجيل طلب جديد في متجر KHT.\n\nرقم الطلب: ${order.number}\nالإجمالي: ${order.total} EGP\nالمصدر: ${order.source}\nوقت التسجيل: ${order.createdAt}\n\nعرض الطلب: ${site}/admin/orders/${encodeURIComponent(row.entityId)}`,
    }
  }
  const cart = await database.prepare(
    `SELECT c.items_count AS itemsCount, c.subtotal,
      c.last_activity AS lastActivity, c.state, c.recovery_state AS recoveryState,
      CASE WHEN c.phone IS NOT NULL OR c.email IS NOT NULL THEN 1 ELSE 0 END AS contactAvailable,
      EXISTS(SELECT 1 FROM orders o WHERE o.cart_id = c.id) AS hasOrder
     FROM abandoned_carts c WHERE c.id = ?`,
  ).bind(row.entityId).first<{
    itemsCount: number; subtotal: number; lastActivity: string; state: string
    recoveryState: string; contactAvailable: number; hasOrder: number
  }>()
  if (!cart || cart.state !== 'active' || cart.hasOrder ||
    !['active', 'contacted'].includes(cart.recoveryState) || cart.itemsCount < 1)
    return { status: 'skip' as const }
  if (Date.now() - new Date(cart.lastActivity).getTime() < inactivityMinutes * 60_000)
    return { status: 'later' as const }
  return {
    status: 'send' as const,
    subject: 'KHT | سلة متروكة جديدة',
    text: `ظهرت سلة متروكة جديدة في متجر KHT.\n\nعدد القطع: ${cart.itemsCount}\nقيمة المنتجات: ${cart.subtotal} EGP\nآخر نشاط: ${cart.lastActivity}\nبيانات تواصل متاحة: ${cart.contactAvailable ? 'نعم' : 'لا'}\n\nعرض السلة: ${site}/admin/abandoned-carts/${encodeURIComponent(row.entityId)}`,
  }
}

export async function deliverAdminNotifications(
  database: D1Database,
  config: AdminEmailConfig,
  limit = 20,
) {
  if (!config.ALERT_EMAIL?.send || !config.MAIL_FROM ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.ADMIN_ALERT_EMAIL || ''))
    return { delivered: 0, retried: 0 }
  const now = new Date().toISOString()
  await database.prepare(
    `UPDATE admin_email_notifications SET state='pending', lease_until=NULL
     WHERE state='sending' AND lease_until < ?`,
  ).bind(now).run()
  const rows = await database.prepare(
    `SELECT kind, entity_id AS entityId, attempts FROM admin_email_notifications
     WHERE state='pending' AND next_attempt_at <= ? ORDER BY created_at LIMIT ?`,
  ).bind(now, limit).all<NotificationRow>()
  let delivered = 0
  let retried = 0
  for (const row of rows.results || []) {
    const leaseUntil = new Date(Date.now() + 30_000).toISOString()
    const claim = await database.prepare(
      `UPDATE admin_email_notifications SET state='sending', lease_until=?
       WHERE kind=? AND entity_id=? AND state='pending' AND next_attempt_at <= ?`,
    ).bind(leaseUntil, row.kind, row.entityId, now).run()
    if (!claim.meta?.changes) continue
    try {
      const message = await notificationMessage(database, row)
      if (message.status === 'skip') {
        await database.prepare(
          `UPDATE admin_email_notifications SET state='skipped', lease_until=NULL
           WHERE kind=? AND entity_id=? AND state='sending'`,
        ).bind(row.kind, row.entityId).run()
        continue
      }
      if (message.status === 'later') {
        await database.prepare(
          `UPDATE admin_email_notifications SET state='pending', lease_until=NULL,
            next_attempt_at=? WHERE kind=? AND entity_id=? AND state='sending'`,
        ).bind(new Date(Date.now() + 5 * 60_000).toISOString(), row.kind, row.entityId).run()
        continue
      }
      await config.ALERT_EMAIL.send({
        to: config.ADMIN_ALERT_EMAIL!,
        from: config.MAIL_FROM,
        subject: message.subject,
        text: message.text,
      })
      await database.prepare(
        `UPDATE admin_email_notifications SET state='sent', delivered_at=?, lease_until=NULL
         WHERE kind=? AND entity_id=? AND state='sending'`,
      ).bind(new Date().toISOString(), row.kind, row.entityId).run()
      delivered++
    } catch {
      const attempts = row.attempts + 1
      const state = attempts >= 12 ? 'dead' : 'pending'
      const delayMinutes = Math.min(1440, 2 ** Math.min(attempts, 10))
      await database.prepare(
        `UPDATE admin_email_notifications SET state=?, attempts=?, next_attempt_at=?,
          lease_until=NULL WHERE kind=? AND entity_id=? AND state='sending'`,
      ).bind(state, attempts, new Date(Date.now() + delayMinutes * 60_000).toISOString(),
        row.kind, row.entityId).run()
      console.warn('KHT admin email alert delivery failed', { kind: row.kind })
      retried++
    }
  }
  return { delivered, retried }
}
