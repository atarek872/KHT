import { buildRobotsText } from '#shared/storefrontSeo'

export default defineEventHandler((event) => {
  const cloudflare = event.context.cloudflare as
    | { env?: { NUXT_PUBLIC_STORE_INDEXING_ENABLED?: string } }
    | undefined
  const runtimeValue = useRuntimeConfig(event).public.storeIndexingEnabled
  const indexingEnabled =
    String(cloudflare?.env?.NUXT_PUBLIC_STORE_INDEXING_ENABLED ?? runtimeValue) === 'true'
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  return buildRobotsText(indexingEnabled)
})
