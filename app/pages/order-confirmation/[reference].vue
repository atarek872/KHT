<script setup lang="ts">
import type { DemoOrder } from '../../../shared/types'
const { t, money, localized } = useLanguage()
const route = useRoute()
const order = ref<DemoOrder | null>(null)
const ready = ref(false)
onMounted(() => {
  try {
    const saved = JSON.parse(sessionStorage.getItem('kht-demo-order') || 'null')
    if (
      saved?.demo === true &&
      saved.reference === route.params.reference &&
      Array.isArray(saved.items)
    )
      order.value = saved
  } catch {}
  ready.value = true
})
useSeoMeta({ title: 'Order preview — KHT', robots: 'noindex, nofollow' })
</script>
<template>
  <main id="main" class="commerce-page confirmation-page light-surface">
    <div v-if="order" class="confirmation-content">
      <span class="confirmation-mark"><KhtIcon name="check" /></span>
      <p class="eyebrow">{{ t('DEMO COMPLETE', 'اكتملت التجربة') }}</p>
      <h1>{{ t('GOOD CHOICE.', 'اختيارك مميز.') }}</h1>
      <p class="confirmation-intro">
        {{
          t(
            'Your order preview is ready. No payment was taken and no commercial order was placed.',
            'معاينة طلبك جاهزة. لم يتم تحصيل مبلغ أو تسجيل طلب تجاري فعلي.',
          )
        }}
      </p>
      <div class="confirmation-reference">
        <span>{{ t('Preview reference', 'رقم المعاينة') }}</span
        ><strong dir="ltr">{{ order.reference }}</strong>
      </div>
      <div class="confirmation-items">
        <div v-for="(item, index) in order.items" :key="index" class="checkout-line">
          <StoreImage :src="item.image" :alt="localized(item.name)" sizes="72px" width="72" height="96" />
          <div>
            <strong>{{ localized(item.name) }}</strong
            ><span>{{ item.size }} / {{ t('Qty', 'الكمية') }} {{ item.quantity }}</span>
          </div>
          <span>{{ money(item.price * item.quantity) }}</span>
        </div>
      </div>
      <div class="summary-row">
        <span>{{ t('Sample delivery', 'توصيل توضيحي') }}</span
        ><span>{{ money(order.shipping) }}</span>
      </div>
      <div v-if="order.discount" class="summary-row">
        <span>{{ t('Discount', 'الخصم') }}<template v-if="order.couponCode"> · {{ order.couponCode }}</template></span
        ><span>− {{ money(order.discount) }}</span>
      </div>
      <div class="summary-row summary-total">
        <strong>{{ t('Demo total', 'الإجمالي التجريبي') }}</strong
        ><strong>{{ money(order.total) }}</strong>
      </div>
      <p class="muted small-copy">
        {{
          t(
            'This preview is available in this browser tab only. No confirmation email was sent.',
            'المعاينة متاحة في علامة التبويب دي فقط. لم يتم إرسال بريد تأكيد.',
          )
        }}
      </p>
      <NuxtLink to="/shop" class="button button-dark"
        >{{ t('Back to the collection', 'ارجع للمجموعة') }}<KhtIcon name="arrow"
      /></NuxtLink>
    </div>
    <div v-else-if="ready" class="empty-state">
      <h1>{{ t('Preview not found.', 'المعاينة غير موجودة.') }}</h1>
      <p>
        {{
          t(
            'Open your preview in the original browser tab, or start a new selection.',
            'افتح المعاينة في علامة التبويب الأصلية، أو ابدأ اختيار جديد.',
          )
        }}
      </p>
      <NuxtLink to="/shop" class="button button-dark">{{ t('Explore KHT', 'اكتشف KHT') }}</NuxtLink>
    </div>
    <p v-else role="status">{{ t('Loading your preview…', 'جارٍ تحميل المعاينة…') }}</p>
  </main>
</template>
