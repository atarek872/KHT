<script setup lang="ts">
const { t } = useLanguage()
const reference = ref('')
const error = ref('')
function findOrder() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('kht-demo-order') || 'null')
    if (saved?.demo === true && saved.reference === reference.value.trim().toUpperCase()) {
      navigateTo(`/order-confirmation/${saved.reference}`)
      return
    }
  } catch {}
  error.value = t(
    'No matching preview in this tab. Check the reference and try again.',
    'مفيش معاينة بالرقم ده في علامة التبويب دي. راجع الرقم وحاول تاني.',
  )
}
useSeoMeta({ title: 'Your order — KHT', robots: 'noindex, nofollow' })
</script>
<template>
  <main id="main" class="info-page light-surface">
    <p class="eyebrow">KHT / {{ t('YOUR ORDER', 'طلبك') }}</p>
    <h1>{{ t('FOLLOW YOUR PIECE.', 'تابع قطعتك.') }}</h1>
    <div class="info-body">
      <p>
        {{
          t(
            'Live order tracking will be available when the store launches. For now, retrieve a demo order preview created in this browser tab.',
            'متابعة الطلبات الحقيقية هتكون متاحة عند الإطلاق. تقدر حاليًا ترجع لمعاينة طلب تجريبي من علامة التبويب دي.',
          )
        }}
      </p>
      <form class="tracking-form" @submit.prevent="findOrder">
        <label for="reference">{{ t('Preview reference', 'رقم المعاينة') }}</label
        ><input
          id="reference"
          v-model="reference"
          placeholder="DEMO-XXXXXXXX"
          required
          dir="ltr"
        /><button class="button button-dark">
          {{ t('Find preview', 'اعرض المعاينة') }}<KhtIcon name="arrow" />
        </button>
        <p v-if="error" role="alert" class="form-error">{{ error }}</p>
      </form>
    </div>
  </main>
</template>
