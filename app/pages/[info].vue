<script setup lang="ts">
import type { StorePageKey } from '#shared/storeContent'
import { useStoreContact } from '#shared/storeConfig'
import { breadcrumbList } from '#shared/storefrontSeo'

const { t, localized } = useLanguage()
const route = useRoute()
const storeContent = useStoreContent()
const slug = computed(() =>
  String(route.params.info) === 'returns' ? 'shipping' : String(route.params.info),
)
const allowed: StorePageKey[] = ['shipping', 'contact', 'faq', 'privacy', 'terms']
if (!allowed.includes(slug.value as StorePageKey))
  throw createError({ statusCode: 404, statusMessage: 'Page not found' })
const page = computed(() => storeContent.value.pages[slug.value as StorePageKey])
const brand = computed(() => storeContent.value.brand)
const contact = computed(() =>
  useStoreContact({
    email: brand.value.contactEmail,
    phone: brand.value.contactPhone,
    whatsapp: brand.value.contactWhatsApp,
  }),
)
const canonicalPath = computed(() => `/${slug.value}`)

useStoreSeo({
  title: computed(() => localized(page.value.seo.title)),
  description: computed(() => localized(page.value.seo.description)),
  path: canonicalPath,
  image: computed(
    () =>
      page.value.seo.socialImageUrl ||
      page.value.hero.imageUrl ||
      brand.value.defaultSocialImageUrl,
  ),
  imageAlt: computed(() => localized(page.value.hero.imageAlt)),
  structuredData: computed(() => ({
    '@context': 'https://schema.org',
    ...breadcrumbList([
      { name: brand.value.name, path: '/' },
      { name: localized(page.value.hero.title), path: canonicalPath.value },
    ]),
  })),
})
</script>

<template>
  <main id="main" class="info-page light-surface">
    <ContentPageHero v-if="page.hero.enabled" :page="page" />
    <template v-else>
      <p class="eyebrow">{{ t(page.hero.eyebrow.en, page.hero.eyebrow.ar) }}</p>
      <h1>{{ t(page.hero.title.en, page.hero.title.ar) }}</h1>
    </template>
    <div class="info-body">
      <section v-for="section in page.sections" :key="section.id">
        <p v-if="localized(section.eyebrow)" class="eyebrow">{{ localized(section.eyebrow) }}</p>
        <h2>{{ localized(section.heading) }}</h2>
        <p>{{ localized(section.body) }}</p>
        <NuxtLink v-if="localized(section.ctaLabel)" :to="section.ctaUrl" class="text-link"
          >{{ localized(section.ctaLabel) }}<KhtIcon name="arrow"
        /></NuxtLink>
      </section>
      <section v-if="slug === 'contact' && contact.configured">
        <h2>{{ t('Official channels', 'وسائل التواصل الرسمية') }}</h2>
        <p v-if="contact.email">
          <a :href="contact.emailHref">{{ contact.email }}</a>
        </p>
        <p v-if="contact.phone">
          <a :href="contact.phoneHref" dir="ltr">{{ contact.phone }}</a>
        </p>
        <p v-if="contact.whatsapp">
          <a :href="contact.whatsappHref" target="_blank" rel="noopener noreferrer" dir="ltr"
            >WhatsApp · {{ contact.whatsapp }}</a
          >
        </p>
      </section>
      <section v-else-if="slug === 'contact'">
        <h2>{{ t('Official channels', 'وسائل التواصل الرسمية') }}</h2>
        <p>
          {{ t('Customer-care details are being prepared.', 'بيانات خدمة العملاء جاري تجهيزها.') }}
        </p>
      </section>
      <NuxtLink to="/shop" class="text-link"
        >{{ t('Explore the collection', 'اكتشف المجموعة') }}<KhtIcon name="arrow"
      /></NuxtLink>
    </div>
  </main>
</template>
