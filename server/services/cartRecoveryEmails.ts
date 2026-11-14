import type { D1Database } from '../utils/d1.ts'
import { getPublicStoreContent } from './storeContent.ts'

type Stage = 'hour_1' | 'hour_24'
type QueueRow = { cartId: string; stage: Stage; attempts: number }
type CartRow = {
  email: string | null
  consentEmail: string | null
  consentAt: string | null
  recoveryToken: string | null
  lastActivity: string
  state: string
  recoveryState: string
  itemsCount: number
  hasOrder: number
}

export interface RecoveryMailConfig {
  BREVO_API_KEY?: string
  BREVO_SENDER_EMAIL?: string
  PUBLIC_SITE_URL?: string
}

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export function recoveryMailConfigured(config: RecoveryMailConfig) {
  if (!config.BREVO_API_KEY || !validEmail(config.BREVO_SENDER_EMAIL || '')) return false
  try {
    return new URL(config.PUBLIC_SITE_URL || '').protocol === 'https:'
  } catch { return false }
}

export async function setCartRecoveryConsent(
  database: D1Database,
  cartId: string,
  email: string,
  consent: boolean,
) {
  const normalized = email.trim().toLowerCase()
  if (!validEmail(normalized)) throw new Error('Enter a valid email address.')
  const now = new Date().toISOString()
  const result = await database.prepare(
    `UPDATE abandoned_carts SET marketing_consent_at=?, marketing_consent_email=?,
       recovery_token=COALESCE(recovery_token, ?), recovery_token_expires_at=?
     WHERE id=? AND lower(email)=? AND state='active' AND items_count>0`,
  ).bind(consent ? now : null, consent ? normalized : null,
    crypto.randomUUID() + crypto.randomUUID(),
    new Date(Date.now() + 30 * 86400000).toISOString(), cartId, normalized).run()
  if (!result.meta?.changes) throw new Error('The bag email changed. Review your details.')
  if (consent) await database.prepare(
    'UPDATE marketing_email_preferences SET unsubscribed_at=NULL WHERE email=?',
  ).bind(normalized).run()
  return { saved: true }
}

export async function hasCartRecoveryConsent(database: D1Database, cartId: string, email: string) {
  const normalized = email.trim().toLowerCase()
  if (!validEmail(normalized)) return false
  const row = await database.prepare(
    `SELECT marketing_consent_at AS consentAt FROM abandoned_carts c
     WHERE id=? AND lower(email)=? AND marketing_consent_email=?
       AND state='active' AND items_count>0
       AND NOT EXISTS(SELECT 1 FROM marketing_email_preferences p
         WHERE p.email=lower(c.email) AND p.unsubscribed_at IS NOT NULL)`,
  ).bind(cartId, normalized, normalized).first<{ consentAt: string | null }>()
  return Boolean(row?.consentAt)
}

export async function captureRecoveryEmails(database: D1Database) {
  const now = new Date().toISOString()
  await database.batch([
    database.prepare(
      `INSERT OR IGNORE INTO cart_recovery_emails(cart_id,stage,next_attempt_at)
       SELECT c.id,'hour_1',? FROM abandoned_carts c
       WHERE c.state='active' AND c.items_count>0
         AND c.recovery_state IN ('active','contacted')
         AND c.email IS NOT NULL AND c.marketing_consent_at IS NOT NULL
         AND lower(c.email)=c.marketing_consent_email
         AND datetime(c.last_activity)<=datetime('now','-1 hour')
         AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.cart_id=c.id)
         AND NOT EXISTS(SELECT 1 FROM marketing_email_preferences p
           WHERE p.email=lower(c.email) AND p.unsubscribed_at IS NOT NULL)`,
    ).bind(now),
    database.prepare(
      `INSERT OR IGNORE INTO cart_recovery_emails(cart_id,stage,next_attempt_at)
       SELECT c.id,'hour_24',? FROM abandoned_carts c
       JOIN cart_recovery_emails first ON first.cart_id=c.id
         AND first.stage='hour_1' AND first.state='sent'
       WHERE c.state='active' AND c.items_count>0
         AND c.recovery_state IN ('active','contacted')
         AND c.email IS NOT NULL AND c.marketing_consent_at IS NOT NULL
         AND lower(c.email)=c.marketing_consent_email
         AND datetime(c.last_activity)<=datetime('now','-24 hours')
         AND (datetime(c.marketing_consent_at)<=datetime(c.last_activity,'+1 hour')
           OR datetime(first.sent_at)<=datetime('now','-24 hours'))
         AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.cart_id=c.id)
         AND NOT EXISTS(SELECT 1 FROM marketing_email_preferences p
           WHERE p.email=lower(c.email) AND p.unsubscribed_at IS NOT NULL)`,
    ).bind(now),
  ])
}

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] || character)
}

export function recoveryMessage(stage: Stage, cartUrl: string, instagramUrl: string, unsubscribeUrl: string) {
  const first = stage === 'hour_1'
  const subject = first
    ? 'KHT | Your selection is waiting · اختياراتك لسه مستنياك'
    : 'KHT | One last look at your bag · بصّة أخيرة على سلتك'
  const enTitle = first ? 'YOUR LINE IS STILL HERE.' : 'ONE LAST LOOK?'
  const arTitle = first ? 'اختياراتك لسه مستنياك.' : 'بصّة أخيرة على سلتك؟'
  const enBody = first
    ? 'You left a few pieces in your bag. Take another look whenever you are ready. Need help with sizing or your order? Message us on Instagram.'
    : 'Your KHT selection is still in your bag. If it feels right, you can finish your order in a few easy steps. Questions? We are here on Instagram.'
  const arBody = first
    ? 'في قطع سيبتها في سلتك. ارجع شوفها وقت ما تحب. محتاج مساعدة في المقاس أو الطلب؟ ابعتلنا على إنستجرام.'
    : 'اختياراتك من KHT لسه في السلة. لو مناسبة ليك، تقدر تكمل طلبك بخطوات بسيطة. عندك سؤال؟ كلمنا على إنستجرام.'
  const safeCart = htmlEscape(cartUrl)
  const safeInstagram = htmlEscape(instagramUrl)
  const safeUnsubscribe = htmlEscape(unsubscribeUrl)
  const text = `${enTitle}\n${enBody}\nContinue your bag: ${cartUrl}\nInstagram: ${instagramUrl}\n\n${arTitle}\n${arBody}\nكمّل طلبك: ${cartUrl}\nإنستجرام: ${instagramUrl}\n\nUnsubscribe / إلغاء رسائل التذكير: ${unsubscribeUrl}`
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f3;color:#111;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #ddd" cellspacing="0" cellpadding="0"><tr><td style="padding:32px"><div style="font-size:38px;font-weight:900;letter-spacing:-2px;text-decoration:underline;text-decoration-thickness:3px;text-underline-offset:6px">KHT</div><p style="font-size:12px;letter-spacing:2px">BLACK. WHITE. LINE.</p><hr style="border:0;border-top:2px solid #111;margin:26px 0"><h1 style="font-size:28px;line-height:1.1">${htmlEscape(enTitle)}</h1><p style="font-size:16px;line-height:1.6">${htmlEscape(enBody)}</p><p><a href="${safeCart}" style="display:inline-block;background:#111;color:#fff;padding:15px 24px;text-decoration:none;font-weight:bold">CONTINUE YOUR BAG</a></p><div dir="rtl" lang="ar" style="text-align:right;margin-top:34px;border-top:1px solid #ddd;padding-top:20px"><h2 style="font-size:25px">${htmlEscape(arTitle)}</h2><p style="font-size:16px;line-height:1.8">${htmlEscape(arBody)}</p><a href="${safeCart}" style="color:#111;font-weight:bold">كمّل طلبك ←</a></div><p style="margin-top:30px;font-size:14px"><a href="${safeInstagram}" style="color:#111">Instagram / إنستجرام</a></p><p style="margin-top:26px;color:#555;font-size:12px;line-height:1.5">Prices and availability are confirmed at checkout.<br>الأسعار والتوفر النهائي بيظهروا عند إتمام الطلب.</p><p style="margin-top:20px;color:#777;font-size:12px"><a href="${safeUnsubscribe}" style="color:#555">Unsubscribe / إلغاء رسائل التذكير</a></p></td></tr></table></td></tr></table></body></html>`
  return { subject, html, text }
}

export async function unsubscribeRecovery(database: D1Database, token: string) {
  if (!/^[a-f0-9-]{72}$/i.test(token)) return false
  const result = await database.prepare(
    'UPDATE marketing_email_preferences SET unsubscribed_at=? WHERE token=?',
  ).bind(new Date().toISOString(), token).run()
  return Boolean(result.meta?.changes)
}

export async function getRecoverySelections(database: D1Database, token: string) {
  if (!/^[a-f0-9-]{72}$/i.test(token)) return null
  const cart = await database.prepare(
    "SELECT id FROM abandoned_carts WHERE recovery_token=? AND datetime(recovery_token_expires_at)>datetime('now') AND state='active' AND items_count>0 LIMIT 1",
  ).bind(token).first<{ id: string }>()
  if (!cart) return null
  const items = await database.prepare(
    `SELECT i.product_id AS id,v.size,i.quantity FROM abandoned_cart_items i
     JOIN inventory_variants v ON v.id=i.variant_id WHERE i.cart_id=? ORDER BY i.rowid`,
  ).bind(cart.id).all<{ id: string; size: string; quantity: number }>()
  return items.results || []
}

export async function deliverRecoveryEmails(
  database: D1Database,
  config: RecoveryMailConfig,
  fetcher: typeof fetch = fetch,
  limit = 20,
) {
  if (!recoveryMailConfigured(config))
    return { sent: 0, retried: 0 }
  let site: URL
  try {
    site = new URL(config.PUBLIC_SITE_URL || '')
    if (site.protocol !== 'https:') return { sent: 0, retried: 0 }
  } catch { return { sent: 0, retried: 0 } }
  const now = new Date().toISOString()
  await database.prepare(
    `UPDATE cart_recovery_emails SET state='pending',lease_until=NULL
     WHERE state='sending' AND lease_until<?`,
  ).bind(now).run()
  const rows = await database.prepare(
    `SELECT cart_id AS cartId,stage,attempts FROM cart_recovery_emails
     WHERE state='pending' AND next_attempt_at<=? ORDER BY next_attempt_at LIMIT ?`,
  ).bind(now, limit).all<QueueRow>()
  let sent = 0
  let retried = 0
  if (!rows.results?.length) return { sent, retried }
  const content = await getPublicStoreContent(database)
  const instagram = /^https:\/\//.test(content.content.brand.instagramUrl)
    ? content.content.brand.instagramUrl : 'https://www.instagram.com/kht.eg'
  for (const row of rows.results || []) {
    const claim = await database.prepare(
      `UPDATE cart_recovery_emails SET state='sending',lease_until=?
       WHERE cart_id=? AND stage=? AND state='pending' AND next_attempt_at<=?`,
    ).bind(new Date(Date.now() + 30_000).toISOString(), row.cartId, row.stage, now).run()
    if (!claim.meta?.changes) continue
    try {
      const cart = await database.prepare(
        `SELECT email,marketing_consent_email AS consentEmail,
         marketing_consent_at AS consentAt,recovery_token AS recoveryToken,
         last_activity AS lastActivity,state,recovery_state AS recoveryState,
         items_count AS itemsCount,
         EXISTS(SELECT 1 FROM orders o WHERE o.cart_id=c.id) AS hasOrder
         FROM abandoned_carts c WHERE id=?`,
      ).bind(row.cartId).first<CartRow>()
      const email = cart?.email?.trim().toLowerCase() || ''
      const preference = email ? await database.prepare(
        'SELECT token,unsubscribed_at AS unsubscribedAt FROM marketing_email_preferences WHERE email=?',
      ).bind(email).first<{ token: string; unsubscribedAt: string | null }>() : null
      const valid = cart && validEmail(email) && cart.consentAt &&
        cart.consentEmail === email && cart.state === 'active' && cart.itemsCount > 0 &&
        ['active', 'contacted'].includes(cart.recoveryState) && !cart.hasOrder &&
        !preference?.unsubscribedAt && cart.recoveryToken
      if (!valid) {
        await database.prepare("UPDATE cart_recovery_emails SET state='skipped',lease_until=NULL WHERE cart_id=? AND stage=?")
          .bind(row.cartId, row.stage).run()
        continue
      }
      const age = Date.now() - new Date(cart.lastActivity).getTime()
      const first = row.stage === 'hour_1'
      const prior = first ? null : await database.prepare(
        "SELECT sent_at AS sentAt FROM cart_recovery_emails WHERE cart_id=? AND stage='hour_1' AND state='sent'",
      ).bind(row.cartId).first<{ sentAt: string }>()
      const olderConsent = new Date(cart.consentAt!).getTime() >
        new Date(cart.lastActivity).getTime() + 60 * 60_000
      if (age < (first ? 60 : 24 * 60) * 60_000 ||
        (!first && (!prior || (olderConsent && Date.now() - new Date(prior.sentAt).getTime() < 24 * 60 * 60_000)))) {
        await database.prepare(
          "UPDATE cart_recovery_emails SET state='pending',lease_until=NULL,next_attempt_at=? WHERE cart_id=? AND stage=?",
        ).bind(new Date(Date.now() + 5 * 60_000).toISOString(), row.cartId, row.stage).run()
        continue
      }
      const token = preference?.token || crypto.randomUUID() + crypto.randomUUID()
      if (!preference) await database.prepare(
        'INSERT OR IGNORE INTO marketing_email_preferences(email,token) VALUES(?,?)',
      ).bind(email, token).run()
      const cartUrl = new URL('/cart', site)
      cartUrl.hash = `recovery=${cart.recoveryToken}`
      const unsubscribeUrl = new URL('/unsubscribe', site)
      unsubscribeUrl.hash = `token=${token}`
      const message = recoveryMessage(row.stage, cartUrl.href, instagram, unsubscribeUrl.href)
      const response = await fetcher('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': config.BREVO_API_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { email: config.BREVO_SENDER_EMAIL, name: 'KHT' },
          to: [{ email }],
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
          replyTo: { email: 'kht.egstore@gmail.com' },
          headers: { IdempotencyKey: `kht-cart-${row.cartId}-${row.stage}` },
          tags: ['cart-recovery'],
        }),
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw new Error('Brevo rejected recovery email')
      const receipt = await response.json() as { messageId?: unknown }
      if (typeof receipt?.messageId !== 'string' || !receipt.messageId)
        throw new Error('Brevo did not acknowledge recovery email')
      await database.prepare(
        "UPDATE cart_recovery_emails SET state='sent',sent_at=?,lease_until=NULL WHERE cart_id=? AND stage=?",
      ).bind(new Date().toISOString(), row.cartId, row.stage).run()
      sent++
    } catch {
      const attempts = row.attempts + 1
      await database.prepare(
        `UPDATE cart_recovery_emails SET state=?,attempts=?,next_attempt_at=?,lease_until=NULL
         WHERE cart_id=? AND stage=?`,
      ).bind(attempts >= 12 ? 'dead' : 'pending', attempts,
        new Date(Date.now() + Math.min(1440, 2 ** Math.min(attempts, 10)) * 60_000).toISOString(),
        row.cartId, row.stage).run()
      console.warn('KHT cart recovery email delivery failed', { stage: row.stage })
      retried++
    }
  }
  return { sent, retried }
}
