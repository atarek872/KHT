<script setup lang="ts">
const { t } = useLanguage()
const route = useRoute()
const token = ref('')
onMounted(() => {
  token.value = route.hash.match(/^#token=([a-f0-9-]{72})$/i)?.[1] || ''
  if (token.value) window.history.replaceState(null, '', route.path)
})
const done = ref(false)
const busy = ref(false)
const error = ref('')
async function unsubscribe() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const result = await $fetch<{ saved: boolean }>('/api/marketing/unsubscribe', {
      method: 'POST', body: { token: token.value },
    })
    if (result.saved) done.value = true
    else error.value = t('This link is no longer available.', 'الرابط لم يعد متاحًا.')
  } catch {
    error.value = t('Please try again.', 'حاول مرة تانية.')
  } finally { busy.value = false }
}
useSeoMeta({ title: () => t('Email preferences — KHT', 'تفضيلات البريد — KHT'), robots: 'noindex, nofollow' })
</script>
<template>
  <main id="main" class="commerce-page light-surface">
    <div class="page-heading">
      <p class="eyebrow">KHT / EMAIL</p>
      <h1>{{ t('EMAIL PREFERENCES.', 'تفضيلات البريد.') }}</h1>
      <p>{{ done
        ? t('You will not receive further bag reminders.', 'مش هيوصلك تذكير تاني بالسلة.')
        : t('Stop receiving bag reminder emails from KHT.', 'إلغاء رسائل التذكير بالسلة من KHT.') }}</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <button v-if="!done" type="button" class="button button-dark" :disabled="busy" @click="unsubscribe">
        {{ t('Unsubscribe', 'إلغاء الاشتراك') }}
      </button>
      <NuxtLink v-else to="/" class="button button-outline">{{ t('Back to KHT', 'الرجوع إلى KHT') }}</NuxtLink>
    </div>
  </main>
</template>
