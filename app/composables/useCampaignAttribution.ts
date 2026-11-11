import { campaignFromQuery, type CampaignAttribution } from '#shared/campaignAttribution'

export function useCampaignAttribution() {
  const attribution = useCookie<CampaignAttribution | null>('kht-campaign', {
    default: () => null,
    sameSite: 'lax',
    maxAge: 2592000,
  })
  function capture(query: Record<string, unknown>) {
    const incoming = campaignFromQuery(query)
    if (incoming) attribution.value = incoming
  }
  return { attribution, capture }
}
