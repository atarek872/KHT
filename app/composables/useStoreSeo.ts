import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'
import {
  DEFAULT_SOCIAL_IMAGE,
  STORE_ORIGIN,
  absoluteStoreUrl,
  serializeJsonLd,
} from '#shared/storefrontSeo'

interface StoreSeoOptions {
  title: MaybeRefOrGetter<string>
  description: MaybeRefOrGetter<string>
  path?: MaybeRefOrGetter<string>
  image?: MaybeRefOrGetter<string>
  imageAlt?: MaybeRefOrGetter<string>
  robots?: MaybeRefOrGetter<string>
  structuredData?: MaybeRefOrGetter<Record<string, unknown>>
}

export function useStoreSeo(options: StoreSeoOptions) {
  const route = useRoute()
  const { locale } = useLanguage()
  const canonical = computed(() => absoluteStoreUrl(toValue(options.path) || route.path))
  const image = computed(() => absoluteStoreUrl(toValue(options.image) || DEFAULT_SOCIAL_IMAGE))
  const title = computed(() => toValue(options.title))
  const description = computed(() => toValue(options.description))
  const imageAlt = computed(() => toValue(options.imageAlt) || title.value)

  useSeoMeta({
    title: () => title.value,
    description: () => description.value,
    ogTitle: () => title.value,
    ogDescription: () => description.value,
    ogType: 'website',
    ogUrl: () => canonical.value,
    ogImage: () => image.value,
    ogImageAlt: () => imageAlt.value,
    ogSiteName: 'KHT',
    ogLocale: () => (locale.value === 'ar' ? 'ar_EG' : 'en_US'),
    ogLocaleAlternate: () => (locale.value === 'ar' ? 'en_US' : 'ar_EG'),
    twitterCard: 'summary_large_image',
    twitterTitle: () => title.value,
    twitterDescription: () => description.value,
    twitterImage: () => image.value,
    twitterImageAlt: () => imageAlt.value,
    robots: options.robots ? () => toValue(options.robots!) : undefined,
  })

  useHead(() => ({
    link: [{ rel: 'canonical', href: canonical.value }],
    script: options.structuredData
      ? [
          {
            key: 'storefront-structured-data',
            type: 'application/ld+json',
            textContent: serializeJsonLd(toValue(options.structuredData!)),
          },
        ]
      : [],
  }))

  return { canonical, image, origin: STORE_ORIGIN }
}
