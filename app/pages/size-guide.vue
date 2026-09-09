<script setup lang="ts">
import { breadcrumbList } from '#shared/storefrontSeo'

const { t } = useLanguage()
const title = computed(() => t('KHT Size Guide — Find Your Fit', 'دليل مقاسات KHT — اختار مقاسك'))
useStoreSeo({
  title,
  description: computed(() =>
    t(
      'Use the KHT size guide to choose the intended oversized fit for Drop 001 hoodies, pants and complete sets.',
      'استخدم دليل مقاسات KHT لاختيار القَصّة الأوفر سايز المناسبة لهوديز وبناطيل وأطقم إصدار 001.',
    ),
  ),
  path: '/size-guide',
  image: '/images/campaign.png',
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
    <p class="eyebrow">KHT / {{ t('SIZE GUIDE', 'دليل المقاسات') }}</p>
    <h1>{{ t('FIND YOUR FIT.', 'اختار مقاسك.') }}</h1>
    <div class="info-body">
      <SizeGuideContent /><NuxtLink to="/shop" class="text-link"
        >{{ t('Back to the collection', 'ارجع للمجموعة') }}<KhtIcon name="arrow"
      /></NuxtLink>
    </div>
  </main>
</template>
