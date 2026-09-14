<script setup lang="ts">
import { setResponseHeader } from 'h3'
import { PRIVATE_ROBOTS, PUBLIC_ROBOTS, isPrivateSeoPath } from '#shared/storefrontSeo'
import type { PublicStoreCurtainPayload } from '../../shared/storeCurtain'

const { locale } = useLanguage()
const catalog = useCatalog()
const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const configuredGoogleTagId = String(runtimeConfig.public.googleTagId || '')
const googleTagId = /^G-[A-Z0-9]+$/.test(configuredGoogleTagId) ? configuredGoogleTagId : ''
const indexingEnabled = computed(() => String(runtimeConfig.public.storeIndexingEnabled) === 'true')
const { data: curtainPayload, refresh: refreshCurtain } = await useFetch<PublicStoreCurtainPayload>(
  '/api/storefront/store-curtain',
)
const curtain = computed(() => curtainPayload.value?.curtain || null)
const curtainActive = computed(() => Boolean(curtain.value))
const robots = computed(() =>
  !curtainActive.value && indexingEnabled.value && !isPrivateSeoPath(route.path)
    ? PUBLIC_ROBOTS
    : 'noindex, nofollow',
)
const { data, error } = await useFetch('/api/catalog')
if (data.value) catalog.value = data.value
useHead(() => ({
  htmlAttrs: { lang: () => locale.value, dir: () => (locale.value === 'ar' ? 'rtl' : 'ltr') },
  script: googleTagId
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
    : [],
}))
useSeoMeta({ robots: () => robots.value })
if (import.meta.server && curtainActive.value) {
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
