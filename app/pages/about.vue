<script setup lang="ts">
import { breadcrumbList } from '#shared/storefrontSeo'

const { t } = useLanguage()
const storeContent = useStoreContent()
const page = computed(() => storeContent.value.pages.about)
const story = computed(() => page.value.sections.find((section) => section.id === 'story'))
const title = computed(() => t(page.value.seo.title.en, page.value.seo.title.ar))
const description = computed(() => t(page.value.seo.description.en, page.value.seo.description.ar))
useStoreSeo({
  title,
  description,
  path: '/about',
  image: computed(
    () =>
      page.value.seo.socialImageUrl ||
      page.value.hero.imageUrl ||
      storeContent.value.brand.defaultSocialImageUrl,
  ),
  imageAlt: computed(() => t(page.value.hero.imageAlt.en, page.value.hero.imageAlt.ar)),
  structuredData: computed(() => ({
    '@context': 'https://schema.org',
    ...breadcrumbList([
      { name: 'KHT', path: '/' },
      { name: t('Our story', 'حكايتنا'), path: '/about' },
    ]),
  })),
})
</script>
<template>
  <main id="main" class="about-page">
    <section class="about-intro">
      <p class="eyebrow">{{ t(page.hero.eyebrow.en, page.hero.eyebrow.ar) }}</p>
      <h1>{{ t(page.hero.title.en, page.hero.title.ar) }}</h1>
      <span class="about-line" />
      <div class="about-copy">
        <p>
          {{ t(page.hero.body.en, page.hero.body.ar) }}
        </p>
        <p>
          {{ t(story?.body.en || '', story?.body.ar || '') }}
        </p>
      </div>
    </section>
    <StoreImage
      class="about-campaign"
      :src="page.hero.imageUrl || '/images/our-story-cover.png'"
      :alt="t(page.hero.imageAlt.en, page.hero.imageAlt.ar)"
      sizes="(max-width: 767px) 100vw, 70vw"
      width="2659"
      height="984"
      loading="lazy"
    />
    <section class="about-ending">
      <span>{{ t(storeContent.brand.tagline.en, storeContent.brand.tagline.ar) }}</span
      ><NuxtLink v-if="page.hero.ctaEnabled" :to="page.hero.ctaUrl" class="button button-white"
        >{{ t(page.hero.ctaLabel.en, page.hero.ctaLabel.ar) }}<KhtIcon name="arrow"
      /></NuxtLink>
    </section>
  </main>
</template>
