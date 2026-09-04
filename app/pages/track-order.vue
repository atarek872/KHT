<script setup lang="ts">
import type { StorefrontOrderView } from '../../shared/storefrontOrder'

const { t, money } = useLanguage()
const reference = ref('')
const phone = ref('')
const busy = ref(false)
const error = ref('')
const order = ref<StorefrontOrderView | null>(null)

async function findOrder() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  order.value = null
  try {
    order.value = await $fetch<StorefrontOrderView>('/api/orders/track', {
      method: 'POST',
      body: { reference: reference.value, phone: phone.value },
    })
  } catch {
    error.value = t(
      'No order matches that reference and phone number. Check both and try again.',
      'مفيش طلب مطابق لرقم الطلب ورقم الموبايل. راجع الاتنين وحاول تاني.',
    )
  } finally {
    busy.value = false
  }
}
useSeoMeta({ title: 'Track your order — KHT', robots: 'noindex, nofollow' })
</script>
<template>
  <main id="main" class="info-page light-surface">
    <p class="eyebrow">KHT / {{ t('YOUR ORDER', 'طلبك') }}</p>
    <h1>{{ t('FOLLOW YOUR PIECE.', 'تابع قطعتك.') }}</h1>
    <div class="info-body">
      <p>
        {{
          t(
            'Enter the order reference and the same phone number used at checkout.',
            'اكتب رقم الطلب ونفس رقم الموبايل اللي استخدمته وقت الطلب.',
          )
        }}
      </p>
      <form class="tracking-form" @submit.prevent="findOrder">
        <label for="reference">{{ t('Order reference', 'رقم الطلب') }}</label>
        <input id="reference" v-model.trim="reference" placeholder="KHT-XXXXXXXXXXXXXXXXXXXX" required maxlength="64" autocapitalize="characters" spellcheck="false" dir="ltr" />
        <label for="tracking-phone">{{ t('Phone number', 'رقم الموبايل') }}</label>
        <input id="tracking-phone" v-model.trim="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="30" />
        <button class="button button-dark" :disabled="busy">
          {{ busy ? t('Checking…', 'جارٍ البحث…') : t('Track order', 'تابع الطلب') }}<KhtIcon name="arrow" />
        </button>
        <p v-if="error" role="alert" class="form-error">{{ error }}</p>
      </form>
      <section v-if="order" class="tracking-result" aria-live="polite" :aria-label="t('Order status', 'حالة الطلب')">
        <p class="eyebrow">{{ t('ORDER FOUND', 'تم العثور على الطلب') }}</p>
        <h2 dir="ltr">{{ order.reference }}</h2>
        <dl>
          <div><dt>{{ t('Order status', 'حالة الطلب') }}</dt><dd>{{ order.fulfillmentStatus }}</dd></div>
          <div><dt>{{ t('Payment', 'الدفع') }}</dt><dd>{{ t('Cash on delivery', 'الدفع عند الاستلام') }} · {{ order.paymentStatus }}</dd></div>
          <div><dt>{{ t('Total', 'الإجمالي') }}</dt><dd>{{ money(order.total) }}</dd></div>
          <div><dt>{{ t('Placed', 'تاريخ الطلب') }}</dt><dd>{{ new Intl.DateTimeFormat('en-EG', { dateStyle: 'medium' }).format(new Date(order.createdAt)) }}</dd></div>
        </dl>
      </section>
    </div>
  </main>
</template>
