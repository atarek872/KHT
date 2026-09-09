<script setup lang="ts">
import type { CustomerOrderDetail } from '../../../server/services/customerOrders'
const route = useRoute()
const { t, money } = useLanguage()
const { data, error, status, refresh } = await useFetch<{ order: CustomerOrderDetail }>(
  `/api/guest-orders/${encodeURIComponent(String(route.params.id))}`,
)
useSeoMeta({ title: 'Your order — KHT', robots: 'noindex, nofollow' })
</script>
<template>
  <main id="main" class="commerce-page light-surface">
    <div class="page-heading">
      <p class="eyebrow">KHT / {{ t('YOUR ORDER', 'طلبك') }}</p>
      <h1>{{ t('THANK YOU.', 'شكرًا لك.') }}</h1>
    </div>
    <p v-if="status === 'pending'" role="status">{{ t('Loading…', 'جارٍ التحميل…') }}</p>
    <p v-else-if="error" role="alert">
      {{ t('Order not found in this browser.', 'الطلب غير متاح في هذا المتصفح.') }}
      <button class="remove-link" @click="refresh()">{{ t('Retry', 'إعادة المحاولة') }}</button>
    </p>
    <template v-else-if="data?.order">
      <h2>{{ data.order.number }}</h2>
      <p>{{ customerStatus(data.order.fulfillmentStatus) }}</p>
      <p>{{ t('Cash on delivery — payment pending.', 'الدفع عند الاستلام — بانتظار الدفع.') }}</p>
      <div v-for="line in data.order.lines" :key="line.id" class="summary-row">
        <span
          >{{ line.productName }} · {{ line.variant }} · {{ line.quantity }} ×
          {{ money(line.unitPrice) }}</span
        ><strong>{{ money(line.total) }}</strong>
      </div>
      <div class="summary-row">
        <span>{{ t('Delivery', 'التوصيل') }}</span
        ><span>{{ money(data.order.shipping) }}</span>
      </div>
      <div v-if="data.order.discount" class="summary-row">
        <span>{{ t('Discount', 'الخصم') }}</span
        ><span>− {{ money(data.order.discount) }}</span>
      </div>
      <div class="summary-row summary-total">
        <strong>{{ t('Total', 'الإجمالي') }}</strong
        ><strong>{{ money(data.order.total) }}</strong>
      </div>
      <p>
        {{ data.order.customerName }}<br />{{ data.order.address }}<br />{{
          data.order.customerPhone
        }}
      </p>
      <h2>{{ t('Order updates', 'تحديثات الطلب') }}</h2>
      <ol>
        <li v-for="(item, i) in data.order.history" :key="i">
          {{ customerStatus(item.status) }} —
          <time :datetime="item.createdAt">{{ new Date(item.createdAt).toLocaleString() }}</time>
        </li>
      </ol>
      <p>
        {{
          t(
            'Keep this page in the same browser to follow your guest order.',
            'احتفظ بهذه الصفحة في نفس المتصفح لمتابعة طلبك كزائر.',
          )
        }}
      </p>
    </template>
    <NuxtLink to="/shop" class="button button-dark">{{
      t('Continue shopping', 'متابعة التسوق')
    }}</NuxtLink>
  </main>
</template>
