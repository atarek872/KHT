<script setup lang="ts">
import { breadcrumbList } from '#shared/storefrontSeo'

const { t } = useLanguage()
const storeContent = useStoreContent()
const page = computed(() => storeContent.value.pages.sizeGuide)
const title = computed(() => t(page.value.seo.title.en, page.value.seo.title.ar))
useStoreSeo({
  title,
  description: computed(() => t(page.value.seo.description.en, page.value.seo.description.ar)),
  path: '/size-guide',
  image: computed(
    () =>
      page.value.seo.socialImageUrl ||
      page.value.hero.imageUrl ||
      storeContent.value.brand.defaultSocialImageUrl,
  ),
  imageAlt: title,
  structuredData: computed(() => ({
    '@context': 'https://schema.org',
    ...breadcrumbList([
      { name: 'KHT', path: '/' },
      { name: t('Size guide', 'دليل المقاسات'), path: '/size-guide' },
    ]),
  })),
})
</script>
<template>
  <main id="main" class="info-page light-surface">
    <ContentPageHero v-if="page.hero.enabled" :page="page" />
    <template v-else
      ><p class="eyebrow">{{ t(page.hero.eyebrow.en, page.hero.eyebrow.ar) }}</p>
      <h1>{{ t(page.hero.title.en, page.hero.title.ar) }}</h1></template
    >
    <div class="info-body">
      <SizeGuideContent /><NuxtLink to="/shop" class="text-link"
        >{{ t('Back to the collection', 'ارجع للمجموعة') }}<KhtIcon name="arrow"
      /></NuxtLink>
    </div>
  </main>
</template>
