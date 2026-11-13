import {
  campaignFromQuery,
  mergeCampaignAttribution,
  type CampaignAttribution,
} from '#shared/campaignAttribution'

export function useCampaignAttribution() {
  const attribution = useCookie<CampaignAttribution | null>('kht-campaign', {
    default: () => null,
    sameSite: 'lax',
    maxAge: 2592000,
  })
  function capture(query: Record<string, unknown>) {
    const incoming = campaignFromQuery(query)
    const browserCookies: Record<string, string> = {}
    if (import.meta.client) {
      for (const entry of document.cookie.split('; ')) {
        const separator = entry.indexOf('=')
        if (separator > 0) browserCookies[entry.slice(0, separator)] = entry.slice(separator + 1)
      }
    }
    const fbc = incoming?.fbclid ? `fb.1.${Date.now()}.${incoming.fbclid}` : browserCookies._fbc
    const merged = mergeCampaignAttribution(attribution.value, incoming, {
      fbc,
      fbp: browserCookies._fbp,
    })
    if (merged) attribution.value = merged
  }
  return { attribution, capture }
}
