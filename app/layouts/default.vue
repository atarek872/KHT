<script setup lang="ts">
import { setResponseHeader } from 'h3'
import {
  PRIVATE_ROBOTS,
  PUBLIC_ROBOTS,
  isPrivateSeoPath,
  resolveStoreIndexingEnabled,
} from '#shared/storefrontSeo'
import {
  storeCurtainAllowsIndexing,
  storeCurtainHttpStatus,
  type PublicStoreCurtainPayload,
} from '#shared/storeCurtain'

const { locale } = useLanguage()
const catalog = useCatalog()
const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const configuredGoogleTagId = String(runtimeConfig.public.googleTagId || '')
const googleTagId = /^G-[A-Z0-9]+$/.test(configuredGoogleTagId) ? configuredGoogleTagId : ''
const configuredMetaPixelId = String(runtimeConfig.public.metaPixelId || '')
const metaPixelId = /^\d{10,20}$/.test(configuredMetaPixelId) ? configuredMetaPixelId : ''
const requestEvent = import.meta.server ? useRequestEvent() : undefined
const cloudflareIndexingValue = (
  requestEvent?.context.cloudflare as
    | { env?: { NUXT_PUBLIC_STORE_INDEXING_ENABLED?: string } }
    | undefined
)?.env?.NUXT_PUBLIC_STORE_INDEXING_ENABLED
const indexingEnabled = useState('store-indexing-enabled', () =>
  resolveStoreIndexingEnabled(runtimeConfig.public.storeIndexingEnabled, cloudflareIndexingValue),
)
const { data: curtainPayload, refresh: refreshCurtain } = await useFetch<PublicStoreCurtainPayload>(
  '/api/storefront/store-curtain',
)
const curtain = computed(() => curtainPayload.value?.curtain || null)
const curtainActive = computed(() => Boolean(curtain.value))
const curtainAllowsIndexing = computed(
  () => !curtain.value || storeCurtainAllowsIndexing(curtain.value.mode, route.path),
)
const robots = computed(() =>
  curtainAllowsIndexing.value && indexingEnabled.value && !isPrivateSeoPath(route.path)
    ? PUBLIC_ROBOTS
    : 'noindex, nofollow',
)
const { data, error } = await useFetch('/api/catalog')
if (data.value) catalog.value = data.value
useHead(() => ({
  htmlAttrs: { lang: () => locale.value, dir: () => (locale.value === 'ar' ? 'rtl' : 'ltr') },
  script: [
    ...(googleTagId
      ? [
          {
            key: 'google-tag-loader',
            async: true,
            src: `https://www.googletagmanager.com/gtag/js?id=${googleTagId}`,
          },
          {
            key: 'google-tag-bootstrap',
            innerHTML: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${googleTagId}');`,
          },
        ]
      : []),
    ...(metaPixelId
      ? [
          {
            key: 'meta-pixel-bootstrap',
            innerHTML: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixelId}');fbq('track','PageView');`,
          },
        ]
      : []),
  ],
  noscript: metaPixelId
    ? [
        {
          key: 'meta-pixel-noscript',
          tagPosition: 'bodyOpen',
          innerHTML: `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1" alt="">`,
        },
      ]
    : [],
}))
if (import.meta.client && metaPixelId) {
  watch(
    () => route.fullPath,
    (currentPath, previousPath) => {
      if (currentPath !== previousPath) {
        (window as Window & { fbq?: (...args: string[]) => void }).fbq?.('track', 'PageView')
      }
    },
  )
}
useSeoMeta({ robots: () => robots.value })
if (
  import.meta.server &&
  curtainActive.value &&
  curtain.value &&
  storeCurtainHttpStatus(curtain.value.mode) === 503
) {
  const event = useRequestEvent()
  if (event) {
    setResponseStatus(event, 503)
    if (curtain.value?.launchAt) {
      const seconds = Math.max(
        60,
        Math.ceil((new Date(curtain.value.launchAt).getTime() - Date.now()) / 1000),
      )
      setResponseHeader(event, 'Retry-After', seconds)
    } else setResponseHeader(event, 'Retry-After', 3600)
  }
}
const { announcement, syncError, restore } = useBag()

async function handleCurtainExpired() {
  await refreshCurtain()
}
</script>

<template>
  <div>
    <div
      class="storefront-shell"
      :inert="curtainActive || undefined"
      :aria-hidden="curtainActive || undefined"
    >
      <a class="skip-link" href="#main">{{
        locale === 'ar' ? 'انتقل للمحتوى' : 'Skip to content'
      }}</a>
      <SiteHeader />
      <div v-if="syncError" class="catalog-error" role="alert">
        {{ syncError }}
        <button class="remove-link" @click="restore(false).catch(() => undefined)">
          {{ locale === 'ar' ? 'إعادة تحميل السلة المحفوظة' : 'Reload saved bag' }}
        </button>
      </div>
      <div v-if="error" class="catalog-error" role="alert">
        {{
          locale === 'ar'
            ? 'تعذر تحميل المنتجات. أعد تحميل الصفحة للمحاولة.'
            : 'Products could not be loaded. Refresh the page to try again.'
        }}
      </div>
      <slot />
      <SiteFooter />
      <BagDrawer v-if="!curtainActive" />
      <WelcomeGift v-if="!curtainActive" />
      <span class="sr-only" role="status" aria-live="polite">{{ announcement }}</span>
    </div>
    <StoreCurtain v-if="curtain" :curtain="curtain" @expired="handleCurtainExpired" />
  </div>
</template>
