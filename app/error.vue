<script setup lang="ts">
import type { NuxtError } from '#app'
defineProps<{ error: NuxtError }>()
const { t, locale } = useLanguage()
useHead({
  htmlAttrs: { lang: () => locale.value, dir: () => (locale.value === 'ar' ? 'rtl' : 'ltr') },
})
</script>
<template>
  <main id="main" class="error-page">
    <a href="/" class="wordmark">KHT</a><span class="long-line" />
    <p>{{ error.statusCode }}</p>
    <h1>
      {{
        error.statusCode === 404
          ? t('OFF THE LINE.', 'خارج الخط.')
          : t('A SMALL INTERRUPTION.', 'لحظة ونرجع.')
      }}
    </h1>
    <p>
      {{
        error.statusCode === 404
          ? t(
              'This page is not part of the collection.',
              'الصفحة دي مش موجودة. ارجع واكتشف المجموعة.',
            )
          : t('We couldn’t load this page. Please try again.', 'تعذر تحميل الصفحة. حاول تاني.')
      }}
    </p>
    <button class="button button-white" @click="clearError({ redirect: '/' })">
      {{ t('Back to KHT', 'ارجع إلى KHT') }} <KhtIcon name="arrow" />
    </button>
  </main>
</template>
