<script setup lang="ts">
const { t } = useLanguage()
useSeoMeta({ title: 'Size guide — KHT' })
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
