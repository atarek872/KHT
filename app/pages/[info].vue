<script setup lang="ts">
import type { StorePageKey } from '#shared/storeContent'
import { useStoreContact } from '#shared/storeConfig'
import { breadcrumbList } from '#shared/storefrontSeo'
import { governorateLabel } from '#shared/governorate'
import type { StorefrontShippingZone } from '#shared/shipping'

const { t, localized, locale, money } = useLanguage()
const route = useRoute()
const storeContent = useStoreContent()
const slug = computed(() =>
  String(route.params.info) === 'returns' ? 'shipping' : String(route.params.info),
)
const allowed: StorePageKey[] = ['shipping', 'contact', 'faq', 'privacy', 'terms']
if (!allowed.includes(slug.value as StorePageKey))
  throw createError({ statusCode: 404, statusMessage: 'Page not found' })
if (slug.value === 'faq' && !storeContent.value.faqEnabled)
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
const { data: shippingData } = await useFetch<{
  items: StorefrontShippingZone[]
  freeShipping: boolean
}>('/api/shipping/options', { key: 'public-shipping-rates' })

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
      <section
        v-if="slug === 'shipping' && shippingData?.items.length"
        class="shipping-rates"
        aria-labelledby="shipping-rates-title"
      >
        <p class="eyebrow">KHT / {{ t('DELIVERY RATES', 'أسعار التوصيل') }}</p>
        <h2 id="shipping-rates-title">
          {{ t('Know your delivery cost.', 'اعرف تكلفة الشحن قبل الطلب.') }}
        </h2>
        <p v-if="shippingData.freeShipping" class="shipping-rates__offer">
          {{
            t(
              'Free delivery is active now. Standard rates are shown for reference.',
              'الشحن مجاني حاليًا. الأسعار المعتادة موضحة للمقارنة.',
            )
          }}
        </p>
        <p v-else>
          {{
            t(
              'Current rates by governorate. Your final total appears in your bag and at checkout.',
              'الأسعار الحالية حسب المحافظة. الإجمالي النهائي يظهر في السلة وقبل تأكيد الطلب.',
            )
          }}
        </p>
        <div class="shipping-rates__grid">
          <div
            v-for="zone in shippingData.items"
            :key="zone.governorate"
            class="shipping-rates__row"
          >
            <span>{{ governorateLabel(zone.governorate, locale) }}</span>
            <strong v-if="shippingData.freeShipping">
              <s v-if="zone.standardRate">{{ money(zone.standardRate) }}</s>
              {{ t('FREE', 'مجاني') }}
            </strong>
            <strong v-else>{{ money(zone.rate) }}</strong>
          </div>
        </div>
      </section>
      <details
        v-for="section in slug === 'faq' ? page.sections : []"
        :key="section.id"
        class="faq-item"
      >
        <summary>{{ localized(section.heading) }}<span aria-hidden="true">+</span></summary>
        <p>{{ localized(section.body) }}</p>
      </details>
      <section v-for="section in slug === 'faq' ? [] : page.sections" :key="section.id">
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
