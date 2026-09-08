<script setup lang="ts">
const { locale } = useLanguage()
const catalog = useCatalog()
const { data, error } = await useFetch('/api/catalog')
if (data.value) catalog.value = data.value
useHead({
  htmlAttrs: { lang: () => locale.value, dir: () => (locale.value === 'ar' ? 'rtl' : 'ltr') },
})
const { announcement, syncError, restore } = useBag()
</script>

<template>
  <div>
    <a class="skip-link" href="#main">{{
      locale === 'ar' ? 'انتقل للمحتوى' : 'Skip to content'
    }}</a>
    <SiteHeader />
    <div v-if="syncError" class="catalog-error" role="alert">
      {{ syncError }}
      <button class="remove-link" @click="restore(false).catch(() => undefined)">
        {{ locale === 'ar' ? 'إعادة تحميل السلة المحفوظة' : 'Reload saved bag' }}
      </button>
    </div>
    <div v-if="error" class="catalog-error" role="alert">
      {{
        locale === 'ar'
          ? 'تعذر تحميل المنتجات. أعد تحميل الصفحة للمحاولة.'
          : 'Products could not be loaded. Refresh the page to try again.'
      }}
    </div>
    <slot />
    <SiteFooter />
    <BagDrawer />
    <span class="sr-only" role="status" aria-live="polite">{{ announcement }}</span>
  </div>
</template>
