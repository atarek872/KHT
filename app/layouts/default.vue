<script setup lang="ts">
import { PRIVATE_ROBOTS, PUBLIC_ROBOTS, isPrivateSeoPath } from '#shared/storefrontSeo'

const { locale } = useLanguage()
const catalog = useCatalog()
const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const configuredGoogleTagId = String(runtimeConfig.public.googleTagId || '')
const googleTagId = /^G-[A-Z0-9]+$/.test(configuredGoogleTagId) ? configuredGoogleTagId : ''
const indexingEnabled = computed(
  () => String(runtimeConfig.public.storeIndexingEnabled) === 'true',
)
const robots = computed(() =>
  indexingEnabled.value && !isPrivateSeoPath(route.path) ? PUBLIC_ROBOTS : PRIVATE_ROBOTS,
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
const { announcement, syncError, restore } = useBag()
</script>

<template>
  <div>
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
    <BagDrawer />
    <span class="sr-only" role="status" aria-live="polite">{{ announcement }}</span>
  </div>
</template>
