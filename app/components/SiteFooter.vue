<script setup lang="ts">
import { useStoreContact } from '#shared/storeConfig'

const { t, localized } = useLanguage()
const catalog = useCatalog()
const storeContent = useStoreContent()
const brand = computed(() => storeContent.value.brand)
const contact = computed(() =>
  useStoreContact({
    email: brand.value.contactEmail,
    phone: brand.value.contactPhone,
    whatsapp: brand.value.contactWhatsApp,
  }),
)
const collectionLinks = computed(() =>
  storeContent.value.navigation.filter(
    (item) =>
      item.enabled &&
      item.footerColumn === 'collection' &&
      (item.href !== '/faq' || storeContent.value.faqEnabled),
  ),
)
const careLinks = computed(() =>
  storeContent.value.navigation.filter(
    (item) =>
      item.enabled &&
      item.footerColumn === 'care' &&
      (item.href !== '/faq' || storeContent.value.faqEnabled),
  ),
)
</script>
<template>
  <footer class="site-footer">
    <div class="footer-top">
      <div class="footer-brand">
        <NuxtLink to="/" class="wordmark">
          <img v-if="brand.logoUrl" :src="brand.logoUrl" :alt="brand.name" />
          <template v-else>{{ brand.name }}<span class="logo-line" /></template>
        </NuxtLink>
        <p>{{ t(brand.tagline.en, brand.tagline.ar) }}</p>
        <span>{{ t(brand.subline.en, brand.subline.ar) }}</span>
      </div>
      <div class="footer-links">
        <p>{{ t(brand.footerCollectionTitle.en, brand.footerCollectionTitle.ar) }}</p>
        <NuxtLink v-for="item in collectionLinks" :key="item.id" :to="item.href">{{
          t(item.label.en, item.label.ar)
        }}</NuxtLink
        ><NuxtLink
          v-for="category in catalog.categories"
          :key="category.slug"
          :to="`/categories/${category.slug}`"
          >{{ localized(category.name) }}</NuxtLink
        >
      </div>
      <div class="footer-links">
        <p>{{ t(brand.footerCareTitle.en, brand.footerCareTitle.ar) }}</p>
        <NuxtLink v-for="item in careLinks" :key="item.id" :to="item.href">{{
          t(item.label.en, item.label.ar)
        }}</NuxtLink>
        <NuxtLink
          v-if="storeContent.faqEnabled && !careLinks.some((item) => item.href === '/faq')"
          to="/faq"
          >{{ t('FAQ', 'الأسئلة الشائعة') }}</NuxtLink
        >
        <a v-if="contact.email" :href="contact.emailHref">{{ contact.email }}</a>
        <a v-if="contact.phone" :href="contact.phoneHref" dir="ltr">{{ contact.phone }}</a>
        <a
          v-if="contact.whatsapp"
          :href="contact.whatsappHref"
          target="_blank"
          rel="noopener noreferrer"
          dir="ltr"
          >WhatsApp · {{ contact.whatsapp }}</a
        >
        <a
          v-if="brand.instagramUrl"
          :href="brand.instagramUrl"
          target="_blank"
          rel="noopener noreferrer"
          >Instagram</a
        >
        <a v-if="brand.tiktokUrl" :href="brand.tiktokUrl" target="_blank" rel="noopener noreferrer"
          >TikTok</a
        >
      </div>
      <div class="footer-statement">
        <span>{{ t(brand.footerStatement.en, brand.footerStatement.ar) }}</span
        ><NuxtLink :to="brand.footerStatementLinkUrl" class="text-link"
          >{{ t(brand.footerStatementLinkLabel.en, brand.footerStatementLinkLabel.ar)
          }}<KhtIcon name="arrow"
        /></NuxtLink>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© {{ new Date().getFullYear() }} {{ brand.name }}</span
      ><span class="footer-concept">{{
        t(brand.footerPaymentLine.en, brand.footerPaymentLine.ar)
      }}</span>
      <div>
        <NuxtLink to="/privacy">{{ t(brand.privacyLabel.en, brand.privacyLabel.ar) }}</NuxtLink
        ><NuxtLink to="/terms">{{ t(brand.termsLabel.en, brand.termsLabel.ar) }}</NuxtLink>
      </div>
    </div>
  </footer>
</template>
