import type {
  PublicWelcomeCampaign,
  WelcomeCampaign,
  WelcomeCampaignInput,
} from '../../shared/welcomeCampaign'
import type { Discount } from '../../shared/discount'
import type { D1Database } from '../utils/d1'

type CampaignRow = {
  enabled: number
  discountId: string
  desktopDelaySeconds: number
  mobileDelaySeconds: number
  dismissalDays: number
  eyebrowEn: string
  eyebrowAr: string
  titleEn: string
  titleAr: string
  bodyEn: string
  bodyAr: string
  primaryLabelEn: string
  primaryLabelAr: string
  primaryRedirect: string
  secondaryLabelEn: string
  secondaryLabelAr: string
  secondaryRedirect: string
  updatedAt: string
  updatedBy: string
  code: string | null
  type: Discount['type'] | null
  value: number | null
  minimumOrder: number | null
  maximumDiscount: number | null
  usageLimit: number | null
  currentUsage: number | null
  validFrom: string | null
  validUntil: string | null
  discountActive: number | null
  discountLoginRequired: number | null
  discountOncePerCustomer: number | null
  discountFirstOrderOnly: number | null
  discountUpdatedAt: string | null
}

const campaignQuery = `SELECT c.enabled, c.discount_id AS discountId,
  c.desktop_delay_seconds AS desktopDelaySeconds,
  c.mobile_delay_seconds AS mobileDelaySeconds, c.dismissal_days AS dismissalDays,
  c.eyebrow_en AS eyebrowEn, c.eyebrow_ar AS eyebrowAr,
  c.title_en AS titleEn, c.title_ar AS titleAr, c.body_en AS bodyEn, c.body_ar AS bodyAr,
  c.primary_label_en AS primaryLabelEn, c.primary_label_ar AS primaryLabelAr,
  c.primary_redirect AS primaryRedirect,
  c.secondary_label_en AS secondaryLabelEn, c.secondary_label_ar AS secondaryLabelAr,
  c.secondary_redirect AS secondaryRedirect,
  c.updated_at AS updatedAt, c.updated_by AS updatedBy,
  d.code, d.type, d.value, d.minimum_order AS minimumOrder,
  d.maximum_discount AS maximumDiscount, d.usage_limit AS usageLimit,
  d.current_usage AS currentUsage, d.valid_from AS validFrom, d.valid_until AS validUntil,
  d.active AS discountActive, d.login_required AS discountLoginRequired,
  d.once_per_customer AS discountOncePerCustomer,
  d.first_order_only AS discountFirstOrderOnly, d.updated_at AS discountUpdatedAt
  FROM welcome_campaign_settings c LEFT JOIN discounts d ON d.id = c.discount_id WHERE c.id = 1`

function mapCampaign(row: CampaignRow): WelcomeCampaign {
  const discount =
    row.code && row.type && row.value != null
      ? {
          id: row.discountId,
          code: row.code,
          type: row.type,
          value: row.value,
          minimumOrder: row.minimumOrder,
          maximumDiscount: row.maximumDiscount,
          usageLimit: row.usageLimit,
          currentUsage: row.currentUsage || 0,
          validFrom: row.validFrom,
          validUntil: row.validUntil,
          active: Boolean(row.discountActive),
          loginRequired: Boolean(row.discountLoginRequired),
          oncePerCustomer: Boolean(row.discountOncePerCustomer),
          firstOrderOnly: Boolean(row.discountFirstOrderOnly),
          updatedAt: row.discountUpdatedAt || row.updatedAt,
        }
      : null
  return {
    enabled: Boolean(row.enabled),
    discountId: row.discountId,
    desktopDelaySeconds: row.desktopDelaySeconds,
    mobileDelaySeconds: row.mobileDelaySeconds,
    dismissalDays: row.dismissalDays,
    eyebrow: { en: row.eyebrowEn, ar: row.eyebrowAr },
    title: { en: row.titleEn, ar: row.titleAr },
    body: { en: row.bodyEn, ar: row.bodyAr },
    primaryLabel: { en: row.primaryLabelEn, ar: row.primaryLabelAr },
    primaryRedirect: row.primaryRedirect,
    secondaryLabel: { en: row.secondaryLabelEn, ar: row.secondaryLabelAr },
    secondaryRedirect: row.secondaryRedirect,
    discount,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  }
}

export async function getWelcomeCampaign(database: D1Database) {
  const row = await database.prepare(campaignQuery).first<CampaignRow>()
  if (!row) throw new Error('Welcome campaign settings are unavailable.')
  return mapCampaign(row)
}

function requiredText(value: string, label: string, maximum: number) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`)
  if (value.trim().length > maximum) throw new Error(`${label} is too long.`)
  return value.trim()
}

function redirectPath(value: string, label: string) {
  const path = requiredText(value, label, 300)
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\r\n]/.test(path)) {
    throw new Error(`${label} must be a store-relative path beginning with /.`)
  }
  return path
}

export function validateWelcomeCampaign(input: WelcomeCampaignInput) {
  if (!input || typeof input !== 'object') throw new Error('Campaign settings are required.')
  for (const [label, value, minimum, maximum] of [
    ['Desktop delay', input.desktopDelaySeconds, 5, 300],
    ['Mobile delay', input.mobileDelaySeconds, 10, 300],
    ['Dismissal period', input.dismissalDays, 1, 365],
  ] as const) {
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new Error(`${label} must be between ${minimum} and ${maximum}.`)
    }
  }
  if (!input.discountId?.trim()) throw new Error('Choose a campaign coupon.')
  requiredText(input.eyebrow.en, 'English eyebrow', 80)
  requiredText(input.eyebrow.ar, 'Arabic eyebrow', 80)
  requiredText(input.title.en, 'English title', 140)
  requiredText(input.title.ar, 'Arabic title', 140)
  requiredText(input.body.en, 'English body', 400)
  requiredText(input.body.ar, 'Arabic body', 400)
  requiredText(input.primaryLabel.en, 'English primary button', 80)
  requiredText(input.primaryLabel.ar, 'Arabic primary button', 80)
  requiredText(input.secondaryLabel.en, 'English secondary link', 100)
  requiredText(input.secondaryLabel.ar, 'Arabic secondary link', 100)
  redirectPath(input.primaryRedirect, 'Primary destination')
  redirectPath(input.secondaryRedirect, 'Secondary destination')
}

export async function saveWelcomeCampaign(
  database: D1Database,
  input: WelcomeCampaignInput,
  actorEmail: string,
) {
  validateWelcomeCampaign(input)
  const discount = await database
    .prepare('SELECT id FROM discounts WHERE id = ?')
    .bind(input.discountId)
    .first<{ id: string }>()
  if (!discount) throw new Error('Choose an existing campaign coupon.')
  const updatedAt = new Date().toISOString()
  await database
    .prepare(
      `UPDATE welcome_campaign_settings SET enabled=?, discount_id=?,
    desktop_delay_seconds=?, mobile_delay_seconds=?, dismissal_days=?, eyebrow_en=?, eyebrow_ar=?,
    title_en=?, title_ar=?, body_en=?, body_ar=?, primary_label_en=?, primary_label_ar=?,
    primary_redirect=?, secondary_label_en=?, secondary_label_ar=?, secondary_redirect=?,
    updated_at=?, updated_by=? WHERE id=1`,
    )
    .bind(
      input.enabled ? 1 : 0,
      input.discountId,
      input.desktopDelaySeconds,
      input.mobileDelaySeconds,
      input.dismissalDays,
      input.eyebrow.en.trim(),
      input.eyebrow.ar.trim(),
      input.title.en.trim(),
      input.title.ar.trim(),
      input.body.en.trim(),
      input.body.ar.trim(),
      input.primaryLabel.en.trim(),
      input.primaryLabel.ar.trim(),
      input.primaryRedirect.trim(),
      input.secondaryLabel.en.trim(),
      input.secondaryLabel.ar.trim(),
      input.secondaryRedirect.trim(),
      updatedAt,
      actorEmail,
    )
    .run()
  return getWelcomeCampaign(database)
}

export async function getPublicWelcomeCampaign(
  database: D1Database,
): Promise<PublicWelcomeCampaign | null> {
  const campaign = await getWelcomeCampaign(database)
  if (!campaign.enabled || !campaign.discount?.active) return null
  return {
    enabled: true,
    revision: `${campaign.updatedAt}:${campaign.discount.updatedAt}`,
    desktopDelaySeconds: campaign.desktopDelaySeconds,
    mobileDelaySeconds: campaign.mobileDelaySeconds,
    dismissalDays: campaign.dismissalDays,
    eyebrow: campaign.eyebrow,
    title: campaign.title,
    body: campaign.body,
    primaryLabel: campaign.primaryLabel,
    primaryRedirect: campaign.primaryRedirect,
    secondaryLabel: campaign.secondaryLabel,
    secondaryRedirect: campaign.secondaryRedirect,
    loginRequired: campaign.discount.loginRequired,
    oncePerCustomer: campaign.discount.oncePerCustomer,
    firstOrderOnly: campaign.discount.firstOrderOnly,
    discount: { type: campaign.discount.type, value: campaign.discount.value },
  }
}
