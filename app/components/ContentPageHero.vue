<script setup lang="ts">
import type { StorePageContent } from '#shared/storeContent'

defineProps<{ page: StorePageContent }>()
const { t } = useLanguage()
</script>

<template>
  <section class="content-page-hero">
    <picture v-if="page.hero.imageUrl" class="content-page-hero__image">
      <source
        v-if="page.hero.mobileImageUrl"
        media="(max-width: 767px)"
        :srcset="page.hero.mobileImageUrl"
      />
      <img :src="page.hero.imageUrl" :alt="t(page.hero.imageAlt.en, page.hero.imageAlt.ar)" />
    </picture>
    <div class="content-page-hero__copy">
      <p class="eyebrow">{{ t(page.hero.eyebrow.en, page.hero.eyebrow.ar) }}</p>
      <h1>{{ t(page.hero.title.en, page.hero.title.ar) }}</h1>
      <p>{{ t(page.hero.body.en, page.hero.body.ar) }}</p>
      <NuxtLink v-if="page.hero.ctaEnabled" :to="page.hero.ctaUrl" class="button button-dark"
        >{{ t(page.hero.ctaLabel.en, page.hero.ctaLabel.ar) }}<KhtIcon name="arrow"
      /></NuxtLink>
    </div>
  </section>
</template>
