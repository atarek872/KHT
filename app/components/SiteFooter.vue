<script setup lang="ts">
const { t, localized } = useLanguage()
const catalog = useCatalog()
</script>
<template>
  <footer class="site-footer">
    <div class="footer-top">
      <div class="footer-brand">
        <NuxtLink to="/" class="wordmark">KHT<span class="logo-line" /></NuxtLink>
        <p>BLACK. WHITE. LINE.</p>
        <span>{{ t('Nothing more. Nothing less.', 'من غير زيادة. من غير نقصان.') }}</span>
      </div>
      <div class="footer-links">
        <p>{{ t('Collection', 'المجموعة') }}</p>
        <NuxtLink to="/shop">{{ t('Shop all', 'كل المنتجات') }}</NuxtLink
        ><NuxtLink
          v-for="category in catalog.categories"
          :key="category.slug"
          :to="`/categories/${category.slug}`"
          >{{ localized(category.name) }}</NuxtLink
        >
      </div>
      <div class="footer-links">
        <p>{{ t('Customer care', 'المساعدة') }}</p>
        <NuxtLink to="/size-guide">{{ t('Size guide', 'دليل المقاسات') }}</NuxtLink
        ><NuxtLink to="/shipping">{{ t('Shipping & returns', 'الشحن والاسترجاع') }}</NuxtLink
        ><NuxtLink to="/track-order">{{ t('Your order', 'طلبك') }}</NuxtLink
        ><NuxtLink to="/contact">{{ t('Contact', 'تواصل معنا') }}</NuxtLink>
      </div>
      <div class="footer-statement">
        <span>{{ t('THE LINE CONNECTS US.', 'الخط يجمعنا.') }}</span
        ><NuxtLink to="/about" class="text-link"
          >{{ t('Discover the story', 'اعرف الحكاية') }}<KhtIcon name="arrow"
        /></NuxtLink>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© {{ new Date().getFullYear() }} KHT</span
      ><span class="footer-concept">{{
        t('Concept storefront · Sample products & prices', 'متجر تصوري · منتجات وأسعار تجريبية')
      }}</span>
      <div>
        <NuxtLink to="/privacy">{{ t('Privacy', 'الخصوصية') }}</NuxtLink
        ><NuxtLink to="/terms">{{ t('Terms', 'الشروط') }}</NuxtLink>
      </div>
    </div>
  </footer>
</template>
