<script setup lang="ts">
import type { StorefrontOrderView } from '../../../shared/storefrontOrder'

const { t, money } = useLanguage()
const route = useRoute()
const reference = computed(() => String(route.params.reference || ''))
const { data: order, error, status } = await useFetch<StorefrontOrderView>(
  () => `/api/orders/${encodeURIComponent(reference.value)}`,
)
useSeoMeta({ title: 'Order confirmed — KHT', robots: 'noindex, nofollow' })
</script>
<template>
  <main id="main" class="commerce-page confirmation-page light-surface">
    <div v-if="order" class="confirmation-content" aria-live="polite">
      <span class="confirmation-mark"><KhtIcon name="check" /></span>
      <p class="eyebrow">{{ t('ORDER RECEIVED', 'تم استلام الطلب') }}</p>
      <h1>{{ t('THANK YOU.', 'شكرًا ليك.') }}</h1>
      <p class="confirmation-intro">
        {{
          t(
            'Your COD order is saved. Keep the reference below; we will contact you to coordinate delivery.',
            'طلب الدفع عند الاستلام اتسجل. احتفظ بالرقم ده وهنتواصل معاك لتنسيق التوصيل.',
          )
        }}
      </p>
      <div class="confirmation-reference">
        <span>{{ t('Order reference', 'رقم الطلب') }}</span
        ><strong dir="ltr">{{ order.reference }}</strong>
      </div>
      <div class="confirmation-items">
        <div v-for="(item, index) in order.lines" :key="index" class="checkout-line">
          <StoreImage v-if="item.image" :src="item.image" :alt="item.productName" sizes="72px" width="72" height="96" />
          <div><strong>{{ item.productName }}</strong
            ><span>{{ item.variant }} / {{ t('Qty', 'الكمية') }} {{ item.quantity }}</span></div>
          <span>{{ money(item.total) }}</span>
        </div>
      </div>
      <div class="summary-row"><span>{{ t('Subtotal', 'المجموع الفرعي') }}</span><span>{{ money(order.subtotal) }}</span></div>
      <div class="summary-row"><span>{{ t('Delivery', 'التوصيل') }}</span><span>{{ money(order.shipping) }}</span></div>
      <div v-if="order.discount" class="summary-row">
        <span>{{ t('Discount', 'الخصم') }}<template v-if="order.discountCode"> · {{ order.discountCode }}</template></span>
        <span>− {{ money(order.discount) }}</span>
      </div>
      <div class="summary-row summary-total">
        <strong>{{ t('Order total', 'إجمالي الطلب') }}</strong><strong>{{ money(order.total) }}</strong>
      </div>
      <div class="delivery-option">
        <div><strong>{{ t('Cash on delivery', 'الدفع عند الاستلام') }}</strong
          ><span>{{ t('Payment is pending until delivery.', 'الدفع معلق لحد الاستلام.') }}</span></div>
        <strong>{{ order.fulfillmentStatus }}</strong>
      </div>
      <p class="muted small-copy">
        {{ t('Next: KHT will confirm the order, prepare it, then hand it to the courier.', 'التالي: هنأكد الطلب ونجهزه وبعدها نسلمه لشركة الشحن.') }}
      </p>
      <div class="confirmation-actions">
        <NuxtLink to="/track-order" class="button button-outline">{{ t('Track this order', 'تابع الطلب') }}</NuxtLink>
        <NuxtLink to="/shop" class="button button-dark">{{ t('Continue shopping', 'كمّل تسوق') }}<KhtIcon name="arrow" /></NuxtLink>
      </div>
    </div>
    <div v-else-if="error" class="empty-state">
      <h1>{{ t('Order not found.', 'الطلب غير موجود.') }}</h1>
      <p>{{ t('Check the reference, or use order tracking with your phone number.', 'راجع رقم الطلب أو استخدم صفحة المتابعة مع رقم الموبايل.') }}</p>
      <NuxtLink to="/track-order" class="button button-dark">{{ t('Track an order', 'تابع طلب') }}</NuxtLink>
    </div>
    <p v-else-if="status === 'pending'" role="status">{{ t('Loading your order…', 'جارٍ تحميل طلبك…') }}</p>
  </main>
</template>
