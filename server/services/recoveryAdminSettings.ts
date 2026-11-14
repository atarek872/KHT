import type { D1Database } from '../utils/d1.ts'
import type { RecoveryMailConfig } from './cartRecoveryEmails.ts'

export type RecoveryCopy = Record<
  'first' | 'second',
  { subject: string; enTitle: string; enBody: string; arTitle: string; arBody: string }
>
export const defaultRecoveryCopy: RecoveryCopy = {
  first: {
    subject: 'KHT | Your selection is waiting · اختياراتك لسه مستنياك',
    enTitle: 'YOUR LINE IS STILL HERE.',
    enBody:
      'You left a few pieces in your bag. Take another look whenever you are ready. Need help with sizing or your order? Message us on Instagram.',
    arTitle: 'اختياراتك لسه مستنياك.',
    arBody:
      'في قطع سيبتها في سلتك. ارجع شوفها وقت ما تحب. محتاج مساعدة في المقاس أو الطلب؟ ابعتلنا على إنستجرام.',
  },
  second: {
    subject: 'KHT | One last look at your bag · بصّة أخيرة على سلتك',
    enTitle: 'ONE LAST LOOK?',
    enBody:
      'Your KHT selection is still in your bag. If it feels right, you can finish your order in a few easy steps. Questions? We are here on Instagram.',
    arTitle: 'بصّة أخيرة على سلتك؟',
    arBody:
      'اختياراتك من KHT لسه في السلة. لو مناسبة ليك، تقدر تكمل طلبك بخطوات بسيطة. عندك سؤال؟ كلمنا على إنستجرام.',
  },
}

type SettingsRow = {
  enabled: number
  senderEmail: string | null
  encryptedApiKey: string | null
  firstDelayMinutes: number
  secondDelayHours: number
  copyJson: string
}
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const encoder = new TextEncoder()
function secretBytes(secret: string) {
  const bytes = Uint8Array.from(atob(secret), (char) => char.charCodeAt(0))
  if (bytes.length !== 32) throw new Error('RECOVERY_SETTINGS_KEY must be 32 bytes in base64.')
  return bytes
}
async function key(secret: string) {
  return crypto.subtle.importKey('raw', secretBytes(secret), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
}
export async function encryptRecoveryKey(value: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(secret), encoder.encode(value)),
  )
  return btoa(String.fromCharCode(...iv, ...data))
}
export async function decryptRecoveryKey(value: string, secret: string) {
  const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, 12) },
      await key(secret),
      bytes.slice(12),
    ),
  )
}
async function row(db: D1Database) {
  return db
    .prepare(
      'SELECT enabled,sender_email AS senderEmail,encrypted_api_key AS encryptedApiKey,first_delay_minutes AS firstDelayMinutes,second_delay_hours AS secondDelayHours,copy_json AS copyJson FROM cart_recovery_settings WHERE id=1',
    )
    .first<SettingsRow>()
}
function copyFrom(value: string): RecoveryCopy {
  try {
    const parsed = JSON.parse(value)
    return {
      first: { ...defaultRecoveryCopy.first, ...parsed.first },
      second: { ...defaultRecoveryCopy.second, ...parsed.second },
    }
  } catch {
    return structuredClone(defaultRecoveryCopy)
  }
}
export async function getRecoveryAdminSettings(db: D1Database) {
  const saved = await row(db)
  return {
    enabled: Boolean(saved?.enabled),
    senderEmail: saved?.senderEmail || '',
    hasApiKey: Boolean(saved?.encryptedApiKey),
    firstDelayMinutes: saved?.firstDelayMinutes || 60,
    secondDelayHours: saved?.secondDelayHours || 24,
    copy: copyFrom(saved?.copyJson || '{}'),
  }
}
export async function saveRecoveryAdminSettings(
  db: D1Database,
  secret: string,
  input: {
    enabled: boolean
    senderEmail: string
    apiKey?: string
    firstDelayMinutes: number
    secondDelayHours: number
    copy?: RecoveryCopy
  },
) {
  if (
    typeof input.enabled !== 'boolean' ||
    !Number.isInteger(input.firstDelayMinutes) ||
    input.firstDelayMinutes < 5 ||
    input.firstDelayMinutes > 10080 ||
    !Number.isInteger(input.secondDelayHours) ||
    input.secondDelayHours < 1 ||
    input.secondDelayHours > 720
  )
    throw new Error('INVALID_SETTINGS')
  if (input.senderEmail && !emailPattern.test(input.senderEmail.trim()))
    throw new Error('INVALID_SENDER')
  if (input.apiKey && (input.apiKey.length < 12 || input.apiKey.length > 512))
    throw new Error('INVALID_API_KEY')
  const copy = input.copy || defaultRecoveryCopy
  for (const part of [copy.first, copy.second])
    for (const field of ['subject', 'enTitle', 'enBody', 'arTitle', 'arBody'] as const)
      if (typeof part?.[field] !== 'string' || !part[field].trim() || part[field].length > 1000)
        throw new Error('INVALID_COPY')
  const existing = await row(db)
  const encrypted = input.apiKey
    ? await encryptRecoveryKey(input.apiKey, secret)
    : existing?.encryptedApiKey || null
  if (input.enabled && (!encrypted || !input.senderEmail)) throw new Error('CONFIGURATION_REQUIRED')
  await db
    .prepare(
      'UPDATE cart_recovery_settings SET enabled=?,sender_email=?,encrypted_api_key=?,first_delay_minutes=?,second_delay_hours=?,copy_json=?,updated_at=? WHERE id=1',
    )
    .bind(
      input.enabled ? 1 : 0,
      input.senderEmail.trim(),
      encrypted,
      input.firstDelayMinutes,
      input.secondDelayHours,
      JSON.stringify(copy),
      new Date().toISOString(),
    )
    .run()
  return getRecoveryAdminSettings(db)
}
export async function loadRecoveryMailConfig(
  db: D1Database,
  secret: string,
  allowDisabled = false,
): Promise<RecoveryMailConfig> {
  const saved = await row(db)
  if (
    !saved ||
    (!allowDisabled && !saved.enabled) ||
    !saved.encryptedApiKey ||
    !saved.senderEmail ||
    !secret
  )
    return {}
  return {
    BREVO_API_KEY: await decryptRecoveryKey(saved.encryptedApiKey, secret),
    BREVO_SENDER_EMAIL: saved.senderEmail,
    PUBLIC_SITE_URL: 'https://kht-eg.com',
    firstDelayMinutes: saved.firstDelayMinutes,
    secondDelayHours: saved.secondDelayHours,
    copy: copyFrom(saved.copyJson),
  }
}
export async function queueManualRecovery(
  db: D1Database,
  cartId: string,
  actorEmail: string,
  consentSource?: string,
) {
  const cart = await db
    .prepare(
      'SELECT email,marketing_consent_at AS consentAt,marketing_consent_email AS consentEmail,state,recovery_state AS recoveryState,items_count AS itemsCount FROM abandoned_carts WHERE id=?',
    )
    .bind(cartId)
    .first<{
      email: string | null
      consentAt: string | null
      consentEmail: string | null
      state: string
      recoveryState: string
      itemsCount: number
    }>()
  if (
    !cart ||
    cart.state !== 'active' ||
    !['active', 'contacted'].includes(cart.recoveryState) ||
    cart.itemsCount < 1 ||
    (await db.prepare('SELECT id FROM orders WHERE cart_id=?').bind(cartId).first())
  )
    throw new Error('NOT_ACTIVE')
  const email = cart.email?.trim().toLowerCase() || ''
  if (!emailPattern.test(email)) throw new Error('EMAIL_REQUIRED')
  if (
    await db
      .prepare(
        'SELECT email FROM marketing_email_preferences WHERE email=? AND unsubscribed_at IS NOT NULL',
      )
      .bind(email)
      .first()
  )
    throw new Error('UNSUBSCRIBED')
  if (
    await db
      .prepare("SELECT cart_id FROM cart_recovery_emails WHERE cart_id=? AND stage='hour_1'")
      .bind(cartId)
      .first()
  )
    throw new Error('ALREADY_QUEUED')
  const approved = Boolean(cart.consentAt && cart.consentEmail === email)
  if (
    !approved &&
    (!consentSource?.trim() || consentSource.trim().length < 10 || consentSource.length > 500)
  )
    throw new Error('CONSENT_REQUIRED')
  const now = new Date().toISOString()
  if (!approved)
    await db
      .prepare(
        "UPDATE abandoned_carts SET marketing_consent_at=?,marketing_consent_email=?,marketing_consent_source=?,marketing_consent_recorded_by=?,recovery_token=COALESCE(recovery_token,?),recovery_token_expires_at=? WHERE id=? AND state='active'",
      )
      .bind(
        now,
        email,
        consentSource!.trim(),
        actorEmail,
        crypto.randomUUID() + crypto.randomUUID(),
        new Date(Date.now() + 30 * 86400000).toISOString(),
        cartId,
      )
      .run()
  const inserted = await db
    .prepare(
      "INSERT OR IGNORE INTO cart_recovery_emails(cart_id,stage,next_attempt_at) VALUES(?,'hour_1',?)",
    )
    .bind(cartId, now)
    .run()
  if (!inserted.meta?.changes) throw new Error('ALREADY_QUEUED')
  return { queued: true }
}
