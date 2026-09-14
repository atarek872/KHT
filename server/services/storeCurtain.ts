import type {
  PublicStoreCurtain,
  StoreCurtain,
  StoreCurtainInput,
  StoreCurtainMode,
} from '../../shared/storeCurtain'
import type { D1Database } from '../utils/d1'

type StoreCurtainRow = {
  enabled: number
  mode: StoreCurtainMode
  titleEn: string
  titleAr: string
  messageEn: string
  messageAr: string
  imageUrl: string | null
  countdownEnabled: number
  launchAt: string | null
  autoDisableAtLaunch: number
  ctaEnabled: number
  ctaLabelEn: string
  ctaLabelAr: string
  ctaUrl: string
  updatedAt: string
  updatedBy: string
}

const selectStoreCurtain = `SELECT enabled, mode, title_en AS titleEn, title_ar AS titleAr,
  message_en AS messageEn, message_ar AS messageAr, image_url AS imageUrl,
  countdown_enabled AS countdownEnabled, launch_at AS launchAt,
  auto_disable_at_launch AS autoDisableAtLaunch, cta_enabled AS ctaEnabled,
  cta_label_en AS ctaLabelEn, cta_label_ar AS ctaLabelAr, cta_url AS ctaUrl,
  updated_at AS updatedAt, updated_by AS updatedBy
  FROM store_curtain_settings WHERE id = 1`

function isEffectivelyActive(curtain: StoreCurtainInput, now: Date) {
  if (!curtain.enabled) return false
  if (!curtain.countdownEnabled || !curtain.autoDisableAtLaunch || !curtain.launchAt) return true
  return new Date(curtain.launchAt).getTime() > now.getTime()
}

function mapStoreCurtain(row: StoreCurtainRow, now = new Date()): StoreCurtain {
  const curtain: StoreCurtainInput = {
    enabled: Boolean(row.enabled),
    mode: row.mode,
    title: { en: row.titleEn, ar: row.titleAr },
    message: { en: row.messageEn, ar: row.messageAr },
    imageUrl: row.imageUrl,
    countdownEnabled: Boolean(row.countdownEnabled),
    launchAt: row.launchAt,
    autoDisableAtLaunch: Boolean(row.autoDisableAtLaunch),
    ctaEnabled: Boolean(row.ctaEnabled),
    ctaLabel: { en: row.ctaLabelEn, ar: row.ctaLabelAr },
    ctaUrl: row.ctaUrl,
  }
  return {
    ...curtain,
    effectiveActive: isEffectivelyActive(curtain, now),
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  }
}

function requiredText(value: unknown, label: string, maximum: number) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`)
  if (value.trim().length > maximum)
    throw new Error(`${label} must be ${maximum} characters or fewer.`)
  return value.trim()
}

function safeCtaUrl(value: unknown) {
  const url = requiredText(value, 'Button destination', 500)
  if (url.startsWith('/') && !url.startsWith('//') && !/[\\\r\n]/.test(url)) return url
  try {
    if (new URL(url).protocol === 'https:') return url
  } catch {
    // The common error below is clearer than the URL parser message.
  }
  throw new Error('Button destination must be a safe store path or HTTPS URL.')
}

export function validateStoreCurtain(input: StoreCurtainInput) {
  if (!input || typeof input !== 'object') throw new Error('Store Curtain settings are required.')
  if (!['coming_soon', 'under_construction', 'custom'].includes(input.mode))
    throw new Error('Choose a valid Store Curtain mode.')
  requiredText(input.title?.en, 'English title', 100)
  requiredText(input.title?.ar, 'Arabic title', 100)
  requiredText(input.message?.en, 'English message', 500)
  requiredText(input.message?.ar, 'Arabic message', 500)
  if (
    input.imageUrl !== null &&
    !/^\/api\/media\/[a-f0-9-]+\.(?:jpg|png|webp)$/.test(input.imageUrl)
  )
    throw new Error('Choose an uploaded KHT media image.')
  if (input.countdownEnabled) {
    if (!input.launchAt)
      throw new Error('Launch date and time is required when the countdown is enabled.')
    if (!Number.isFinite(new Date(input.launchAt).getTime()))
      throw new Error('Choose a valid launch date and time.')
  }
  if (input.ctaEnabled) {
    requiredText(input.ctaLabel?.en, 'English button label', 80)
    requiredText(input.ctaLabel?.ar, 'Arabic button label', 80)
    safeCtaUrl(input.ctaUrl)
  }
}

export async function getStoreCurtain(database: D1Database, now = new Date()) {
  const row = await database.prepare(selectStoreCurtain).first<StoreCurtainRow>()
  if (!row) throw new Error('Store Curtain settings are unavailable.')
  const curtain = mapStoreCurtain(row, now)
  if (
    curtain.enabled &&
    !curtain.effectiveActive &&
    curtain.countdownEnabled &&
    curtain.autoDisableAtLaunch
  ) {
    const updatedAt = now.toISOString()
    await database
      .prepare(
        `UPDATE store_curtain_settings SET enabled=0, updated_at=?, updated_by='system:auto-launch' WHERE id=1 AND enabled=1`,
      )
      .bind(updatedAt)
      .run()
    return { ...curtain, enabled: false, updatedAt, updatedBy: 'system:auto-launch' }
  }
  return curtain
}

export async function saveStoreCurtain(
  database: D1Database,
  input: StoreCurtainInput,
  actorEmail: string,
) {
  validateStoreCurtain(input)
  const updatedAt = new Date().toISOString()
  const imageUrl = input.imageUrl || null
  const launchAt =
    input.countdownEnabled && input.launchAt ? new Date(input.launchAt).toISOString() : null
  await database
    .prepare(
      `UPDATE store_curtain_settings SET enabled=?, mode=?, title_en=?, title_ar=?,
      message_en=?, message_ar=?, image_url=?, countdown_enabled=?, launch_at=?,
      auto_disable_at_launch=?, cta_enabled=?, cta_label_en=?, cta_label_ar=?, cta_url=?,
      updated_at=?, updated_by=? WHERE id=1`,
    )
    .bind(
      input.enabled ? 1 : 0,
      input.mode,
      input.title.en.trim(),
      input.title.ar.trim(),
      input.message.en.trim(),
      input.message.ar.trim(),
      imageUrl,
      input.countdownEnabled ? 1 : 0,
      launchAt,
      input.autoDisableAtLaunch ? 1 : 0,
      input.ctaEnabled ? 1 : 0,
      input.ctaLabel.en.trim(),
      input.ctaLabel.ar.trim(),
      input.ctaEnabled ? safeCtaUrl(input.ctaUrl) : input.ctaUrl.trim() || '/',
      updatedAt,
      actorEmail,
    )
    .run()
  return getStoreCurtain(database)
}

export async function getPublicStoreCurtain(
  database: D1Database,
  now = new Date(),
): Promise<PublicStoreCurtain | null> {
  const curtain = await getStoreCurtain(database, now)
  if (!curtain.effectiveActive) return null
  return {
    enabled: true,
    mode: curtain.mode,
    title: curtain.title,
    message: curtain.message,
    imageUrl: curtain.imageUrl,
    countdownEnabled: curtain.countdownEnabled,
    launchAt: curtain.launchAt,
    autoDisableAtLaunch: curtain.autoDisableAtLaunch,
    ctaEnabled: curtain.ctaEnabled,
    ctaLabel: curtain.ctaLabel,
    ctaUrl: curtain.ctaUrl,
    revision: curtain.updatedAt,
  }
}
