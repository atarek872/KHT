export interface CampaignAttribution {
  source?: string
  medium?: string
  campaign?: string
  content?: string
  term?: string
  utmId?: string
  campaignId?: string
  adsetId?: string
  adId?: string
  fbclid?: string
  fbc?: string
  fbp?: string
}

const queryKeys: Partial<Record<keyof CampaignAttribution, string>> = {
  source: 'utm_source',
  medium: 'utm_medium',
  campaign: 'utm_campaign',
  content: 'utm_content',
  term: 'utm_term',
  utmId: 'utm_id',
  campaignId: 'campaign_id',
  adsetId: 'adset_id',
  adId: 'ad_id',
  fbclid: 'fbclid',
}

const clickKeys = new Set<keyof CampaignAttribution>(['fbclid', 'fbc', 'fbp'])

export function sanitizeCampaignAttribution(value: unknown): CampaignAttribution | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const result: CampaignAttribution = {}
  for (const key of [...Object.keys(queryKeys), 'fbc', 'fbp'] as (keyof CampaignAttribution)[]) {
    const raw = input[key]
    if (typeof raw !== 'string') continue
    const clean = raw.trim().slice(0, clickKeys.has(key) ? 250 : 100)
    if (clickKeys.has(key) ? /^[a-zA-Z0-9_.-]+$/.test(clean) : /^[\p{L}\p{N}_ .+-]+$/u.test(clean))
      result[key] = clean
  }
  return Object.keys(result).length ? result : null
}

export function campaignFromQuery(query: Record<string, unknown>): CampaignAttribution | null {
  const values: Record<string, unknown> = {}
  for (const [key, parameter] of Object.entries(queryKeys)) values[key] = query[parameter]
  if (!values.source && typeof query.fbclid === 'string') values.source = 'facebook'
  return sanitizeCampaignAttribution(values)
}

export function mergeCampaignAttribution(
  current: CampaignAttribution | null,
  incoming: CampaignAttribution | null,
  identifiers: { fbc?: string; fbp?: string } = {},
) {
  const newCampaign = Boolean(
    incoming?.source || incoming?.campaign || incoming?.utmId || incoming?.fbclid,
  )
  return sanitizeCampaignAttribution({
    ...(newCampaign ? {} : current),
    ...incoming,
    ...identifiers,
  })
}
