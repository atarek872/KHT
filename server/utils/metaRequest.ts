import type { H3Event } from 'h3'
import type { CampaignAttribution } from '../../shared/campaignAttribution.ts'
import type { MetaRequestContext } from '../services/metaCapi.ts'
import { deliverMetaOutbox, metaConfiguration } from '../services/metaCapi.ts'
import { deliverGa4Outbox } from '../services/ga4Purchase.ts'
import type { D1Database } from './d1.ts'

interface CloudflareMetaContext {
  env?: Record<string, unknown>
  context?: { waitUntil(promise: Promise<unknown>): void }
}

export function metaRequestContext(
  event: H3Event,
  path: string,
  attribution: CampaignAttribution | null = null,
): MetaRequestContext {
  const safePath =
    path.startsWith('/') && !path.startsWith('//') && !/[?#\\\r\n]/.test(path) && path.length <= 300
      ? path
      : '/'
  const ip = getHeader(event, 'cf-connecting-ip')
  const userAgent = getHeader(event, 'user-agent')
  const fbcCookie = getCookie(event, '_fbc')
  const fbpCookie = getCookie(event, '_fbp')
  const allowedTestCode = (event.context.cloudflare as CloudflareMetaContext | undefined)?.env
    ?.META_CAPI_TEST_ALLOWED_CODE
  const providedTestCode = getHeader(event, 'x-kht-meta-test-code')
  const measurementId = (event.context.cloudflare as CloudflareMetaContext | undefined)?.env
    ?.NUXT_PUBLIC_GOOGLE_TAG_ID
  const gaSessionCookieName =
    typeof measurementId === 'string' && /^G-[A-Z0-9]+$/.test(measurementId)
      ? `_ga_${measurementId.slice(2)}`
      : null
  return {
    eventSourceUrl: `${getRequestURL(event).origin}${safePath}`,
    ...(ip && /^[a-fA-F0-9:.]{3,45}$/.test(ip) ? { ip } : {}),
    ...(userAgent ? { userAgent } : {}),
    fbp: fbpCookie || attribution?.fbp,
    fbc: attribution?.fbclid
      ? attribution.fbc || `fb.1.${Date.now()}.${attribution.fbclid}`
      : fbcCookie || attribution?.fbc,
    gaCookie: getCookie(event, '_ga'),
    gaSessionCookie: gaSessionCookieName ? getCookie(event, gaSessionCookieName) : undefined,
    ga4Debug:
      (event.context.cloudflare as CloudflareMetaContext | undefined)?.env?.GA4_DEBUG_MODE ===
      'true',
    ...(typeof allowedTestCode === 'string' &&
    /^TEST[0-9A-Za-z]{4,20}$/.test(allowedTestCode) &&
    providedTestCode === allowedTestCode
      ? { testEventCode: allowedTestCode }
      : {}),
  }
}

export function scheduleMetaDelivery(
  event: H3Event,
  database: D1Database,
  eventName: string,
  eventId: string,
) {
  const cloudflare = event.context.cloudflare as CloudflareMetaContext | undefined
  const config = metaConfiguration(cloudflare?.env)
  if (!cloudflare?.context?.waitUntil) return
  if (config.accessToken)
    cloudflare.context.waitUntil(
      deliverMetaOutbox(database, config, { eventName, eventId, limit: 1 }).catch(() => {
        console.warn('Meta CAPI background delivery could not start', { event: eventName })
      }),
    )
  if (eventName === 'Purchase' && cloudflare.env?.GA4_API_SECRET)
    cloudflare.context.waitUntil(
      deliverGa4Outbox(
        database,
        {
          measurementId: String(cloudflare.env.NUXT_PUBLIC_GOOGLE_TAG_ID || ''),
          apiSecret: String(cloudflare.env.GA4_API_SECRET),
        },
        { transactionId: eventId, limit: 1 },
      ).catch(() => {
        console.warn('GA4 purchase background delivery could not start')
      }),
    )
}
