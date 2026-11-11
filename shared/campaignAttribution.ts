export interface CampaignAttribution {
  source?: string
  medium?: string
  campaign?: string
  content?: string
  term?: string
}

const queryKeys: Record<keyof CampaignAttribution, string> = {
  source: 'utm_source',
  medium: 'utm_medium',
  campaign: 'utm_campaign',
  content: 'utm_content',
  term: 'utm_term',
}

export function sanitizeCampaignAttribution(value: unknown): CampaignAttribution | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const result: CampaignAttribution = {}
  for (const key of Object.keys(queryKeys) as (keyof CampaignAttribution)[]) {
    const raw = input[key]
    if (typeof raw !== 'string') continue
    const clean = raw.trim().slice(0, 100)
    if (/^[\p{L}\p{N}_ .+-]+$/u.test(clean)) result[key] = clean
  }
  return Object.keys(result).length ? result : null
}

export function campaignFromQuery(query: Record<string, unknown>): CampaignAttribution | null {
  const values: Record<string, unknown> = {}
  for (const [key, parameter] of Object.entries(queryKeys)) values[key] = query[parameter]
  if (!values.source && typeof query.fbclid === 'string') values.source = 'facebook'
  return sanitizeCampaignAttribution(values)
}
