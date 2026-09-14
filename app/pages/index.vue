<script setup lang="ts">
import { useStoreContact } from '#shared/storeConfig'
import { DEFAULT_SOCIAL_IMAGE, STORE_ORIGIN } from '#shared/storefrontSeo'

const { t, localized } = useLanguage()
const catalog = useCatalog()
const storeContent = useStoreContent()
const page = computed(() => storeContent.value.pages.home)
const brand = computed(() => storeContent.value.brand)
const section = (id: string) => computed(() => page.value.sections.find((item) => item.id === id)!)
const collectionContent = section('collection')
const manifestoContent = section('manifesto')
const manifestoHeading = computed(() =>
  t(manifestoContent.value.heading.en, manifestoContent.value.heading.ar).split('\n'),
)
const categoriesContent = section('categories')
const closingContent = section('closing')
const contact = computed(() =>
  useStoreContact({
    email: brand.value.contactEmail,
    phone: brand.value.contactPhone,
    whatsapp: brand.value.contactWhatsApp,
  }),
)
const homepageUrl = `${STORE_ORIGIN}/`
const socialImageUrl = computed(
  () => page.value.seo.socialImageUrl || brand.value.defaultSocialImageUrl || DEFAULT_SOCIAL_IMAGE,
)
const socialTitle = computed(() => t(page.value.seo.title.en, page.value.seo.title.ar))
const socialDescription = computed(() =>
  t(page.value.seo.description.en, page.value.seo.description.ar),
)
const storeStructuredData = computed(() => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'OnlineStore',
      '@id': `${homepageUrl}#store`,
      name: brand.value.name,
      alternateName: t(brand.value.tagline.en, brand.value.tagline.ar),
      url: homepageUrl,
      logo: `${STORE_ORIGIN}/favicon.svg`,
      image: socialImageUrl.value,
      description: socialDescription.value,
      areaServed: 'EG',
      currenciesAccepted: 'EGP',
      paymentAccepted: 'Cash on delivery',
      contactPoint: contact.value.configured
        ? {
            '@type': 'ContactPoint',
            contactType: 'customer service',
            email: contact.value.email || undefined,
            telephone: contact.value.phone ? contact.value.phone.replace(/^0/, '+20') : undefined,
            areaServed: 'EG',
            availableLanguage: ['Arabic', 'English'],
          }
        : undefined,
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'EG',
        returnPolicyCountry: 'EG',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 14,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${homepageUrl}#website`,
      name: brand.value.name,
      alternateName: 'KHT Egypt',
      url: homepageUrl,
      inLanguage: ['en', 'ar'],
      publisher: { '@id': `${homepageUrl}#store` },
    },
  ],
}))

useStoreSeo({
  title: socialTitle,
  description: socialDescription,
  path: homepageUrl,
  image: socialImageUrl,
  imageAlt: computed(() => t(page.value.hero.imageAlt.en, page.value.hero.imageAlt.ar)),
  structuredData: storeStructuredData,
})
</script>
<template>
  <main id="main">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-image">
        <picture>
          <source
            v-if="page.hero.mobileImageUrl"
            media="(max-width: 767px)"
            :srcset="page.hero.mobileImageUrl"
          />
          <StoreImage
            :src="page.hero.imageUrl || '/images/campaign.png'"
            sizes="(max-width: 767px) 100vw, 72vw"
            :alt="t(page.hero.imageAlt.en, page.hero.imageAlt.ar)"
            fetchpriority="high"
            width="1672"
            height="941"
          />
        </picture>
      </div>
      <div class="hero-content">
        <div class="hero-edition">
          <span class="small-line" /><span>{{
            t(page.hero.eyebrow.en, page.hero.eyebrow.ar)
          }}</span>
        </div>
        <h1 id="hero-title">{{ t(page.hero.title.en, page.hero.title.ar) }}</h1>
        <div class="hero-signature-line" />
        <p>
          {{ t(page.hero.body.en, page.hero.body.ar) }}
        </p>
        <NuxtLink v-if="page.hero.ctaEnabled" :to="page.hero.ctaUrl" class="button button-white"
          >{{ t(page.hero.ctaLabel.en, page.hero.ctaLabel.ar) }}<KhtIcon name="arrow"
        /></NuxtLink>
      </div>
      <span class="hero-image-caption">KHT / STUDY IN CONTRAST</span
      ><a href="#collection" class="hero-scroll"
        >{{ t('Scroll to discover', 'انزل واكتشف') }}<span>↓</span></a
      >
    </section>
    <div class="brand-strip">
      <span>{{ t('A STUDY IN CONTRAST', 'دراسة في التباين') }}</span
      ><span class="brand-strip-center">{{
        t('ONE LINE. NO NOISE.', 'خط واحد. من غير ضوضاء.')
      }}</span
      ><span>{{ t('DESIGNED TO STAND APART', 'تفاصيل تميزك') }}</span>
    </div>
    <section id="collection" class="collection-section light-surface">
      <div class="section-heading">
        <div>
          <p class="eyebrow">{{ t(collectionContent.eyebrow.en, collectionContent.eyebrow.ar) }}</p>
          <h2>{{ t(collectionContent.heading.en, collectionContent.heading.ar) }}</h2>
        </div>
        <NuxtLink :to="collectionContent.ctaUrl" class="text-link"
          >{{ t(collectionContent.ctaLabel.en, collectionContent.ctaLabel.ar)
          }}<KhtIcon name="arrow"
        /></NuxtLink>
      </div>
      <div class="product-grid">
        <ProductCard
          v-for="(product, index) in catalog.products"
          :key="product.id"
          :product="product"
          :index="index"
        />
      </div>
      <div class="collection-footnote">
        <span>{{ t(collectionContent.body.en, collectionContent.body.ar) }}</span
        ><span>001 — 003</span>
      </div>
    </section>
    <section class="manifesto-section">
      <div class="manifesto-top">
        <span>{{ t(manifestoContent.eyebrow.en, manifestoContent.eyebrow.ar) }}</span>
      </div>
      <div class="manifesto-layout">
        <h2>
          {{ manifestoHeading[0] }}<br /><span>{{ manifestoHeading[1] }}</span
          ><template v-if="manifestoHeading[2]"><br />{{ manifestoHeading[2] }}</template>
        </h2>
        <div class="manifesto-copy">
          <span class="long-line" />
          <p>
            {{ t(manifestoContent.body.en, manifestoContent.body.ar) }}
          </p>
          <NuxtLink :to="manifestoContent.ctaUrl" class="text-link"
            >{{ t(manifestoContent.ctaLabel.en, manifestoContent.ctaLabel.ar)
            }}<KhtIcon name="arrow"
          /></NuxtLink>
        </div>
      </div>
    </section>
    <section class="category-section">
      <div class="section-heading">
        <h2>{{ t(categoriesContent.heading.en, categoriesContent.heading.ar) }}</h2>
        <span>{{ t(categoriesContent.body.en, categoriesContent.body.ar) }}</span>
      </div>
      <div class="category-list">
        <NuxtLink
          v-for="(category, index) in catalog.categories"
          :key="category.slug"
          :to="`/categories/${category.slug}`"
          class="category-row"
          ><span class="category-index">0{{ index + 1 }}</span
          ><span class="category-name">{{ localized(category.name) }}</span
          ><span class="category-count"
            >{{ catalog.products.filter((p) => p.category === category.slug).length }}
            {{ t('piece', 'قطعة') }}</span
          ><KhtIcon name="arrow"
        /></NuxtLink>
      </div>
    </section>
    <section class="closing-campaign">
      <span class="closing-line" aria-hidden="true" />
      <div class="closing-copy">
        <span>{{ t(closingContent.eyebrow.en, closingContent.eyebrow.ar) }}</span>
        <h2>{{ t(closingContent.heading.en, closingContent.heading.ar) }}</h2>
        <NuxtLink :to="closingContent.ctaUrl" class="button button-white"
          >{{ t(closingContent.ctaLabel.en, closingContent.ctaLabel.ar) }}<KhtIcon name="arrow"
        /></NuxtLink>
      </div>
    </section>
  </main>
</template>
