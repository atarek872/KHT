<script setup lang="ts">
definePageMeta({ middleware: 'customer' })
const { t, money, locale } = useLanguage()
const route = useRoute()
interface Detail {
  id: string
  number: string
  customerName: string
  customerPhone: string
  customerEmail: string
  address: string
  subtotal: number
  shipping: number
  discount: number
  total: number
  paymentMethod: string
  paymentStatus: string
  fulfillmentStatus: string
  createdAt: string
  trackingNumber: string | null
  trackingCarrier: string | null
  lines: {
    id: string
    productName: string
    variant: string
    quantity: number
    unitPrice: number
    total: number
  }[]
  history: { status: string; createdAt: string }[]
}
const { data, status, error, refresh } = await useFetch<{ order: Detail }>(
  `/api/account/orders/${encodeURIComponent(String(route.params.id))}`,
  { key: `customer-order-${route.params.id}` },
)
const order = computed(() => data.value?.order)
const date = (value: string) =>
  new Date(value).toLocaleString(locale.value === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
const steps = ['pending', 'confirmed', 'processing', 'shipped', 'out-for-delivery', 'delivered']
const exceptional = computed(() =>
  ['cancelled', 'returned'].includes(order.value?.fulfillmentStatus || ''),
)
</script>
<template>
  <AccountShell :title="t('ORDER DETAILS.', 'تفاصيل الطلب.')">
    <NuxtLink to="/account/orders" class="account-text-button">{{
      t('Back to orders', 'العودة للطلبات')
    }}</NuxtLink>
    <p v-if="status === 'pending'" role="status">
      {{ t('Loading your order…', 'جاري تحميل طلبك…') }}
    </p>
    <div v-else-if="error" class="account-notice" role="alert">
      {{
        t(
          'This order could not be loaded. Check your account or try again.',
          'تعذر تحميل هذا الطلب. تحقق من حسابك أو حاول مجدداً.',
        )
      }}
      <button class="account-text-button" @click="refresh()">
        {{ t('Try again', 'حاول مجدداً') }}
      </button>
    </div>
    <template v-else-if="order"
      ><section class="account-section">
        <div class="account-row">
          <h2>
            <bdi>{{ order.number }}</bdi>
          </h2>
          <span class="account-badge">{{ customerStatus(order.fulfillmentStatus) }}</span>
        </div>
        <p class="muted">
          <time :datetime="order.createdAt">{{ date(order.createdAt) }}</time>
        </p>
        <h3>{{ t('Track your order', 'تتبع طلبك') }}</h3>
        <p v-if="exceptional" class="account-notice">
          {{ t('Current status:', 'الحالة الحالية:') }}
          {{ customerStatus(order.fulfillmentStatus) }}
        </p>
        <ol v-else class="account-tracker" :aria-label="t('Delivery progress', 'مراحل التوصيل')">
          <li
            v-for="step in steps"
            :key="step"
            :class="{
              'is-current': order.fulfillmentStatus === step,
              'is-recorded': order.history.some((event) => event.status === step),
            }"
            :aria-current="order.fulfillmentStatus === step ? 'step' : undefined"
          >
            <span class="account-tracker-dot" />{{ customerStatus(step)
            }}<small v-if="order.fulfillmentStatus === step">{{ t('Current', 'الحالي') }}</small>
          </li>
        </ol>
        <p v-if="order.trackingNumber">
          {{ t('Carrier / tracking reference', 'شركة الشحن / رقم التتبع') }}:
          {{ order.trackingCarrier }} <bdi>{{ order.trackingNumber }}</bdi>
        </p>
        <p v-else class="account-help">
          {{
            t(
              'A carrier tracking reference will appear here when it is available.',
              'سيظهر رقم تتبع شركة الشحن هنا عند توفره.',
            )
          }}
        </p>
        <details class="account-history">
          <summary>{{ t('Recorded updates', 'التحديثات المسجلة') }}</summary>
          <ol v-if="order.history.length">
            <li v-for="(event, index) in order.history" :key="index">
              <strong>{{ customerStatus(event.status) }}</strong
              ><time :datetime="event.createdAt">{{ date(event.createdAt) }}</time>
            </li>
          </ol>
          <p v-else>{{ t('No status updates recorded yet.', 'لم تسجل تحديثات للحالة بعد.') }}</p>
        </details>
      </section>
      <section class="account-section">
        <h2>{{ t('Your pieces', 'قطعك') }}</h2>
        <article v-for="line in order.lines" :key="line.id" class="account-line">
          <div>
            <h3>{{ line.productName }}</h3>
            <p class="account-help">
              {{ line.variant }} · {{ t('Quantity', 'الكمية') }} {{ line.quantity }} ·
              {{ money(line.unitPrice) }}
            </p>
          </div>
          <strong>{{ money(line.total) }}</strong>
        </article>
        <dl class="account-totals">
          <div>
            <dt>{{ t('Subtotal', 'المجموع الفرعي') }}</dt>
            <dd>{{ money(order.subtotal) }}</dd>
          </div>
          <div>
            <dt>{{ t('Shipping', 'الشحن') }}</dt>
            <dd>{{ money(order.shipping) }}</dd>
          </div>
          <div v-if="order.discount">
            <dt>{{ t('Discount', 'الخصم') }}</dt>
            <dd>−{{ money(order.discount) }}</dd>
          </div>
          <div class="account-total">
            <dt>{{ t('Total', 'الإجمالي') }}</dt>
            <dd>{{ money(order.total) }}</dd>
          </div>
        </dl>
      </section>
      <div class="account-detail-grid">
        <section class="account-section">
          <h2>{{ t('Delivery details', 'تفاصيل التوصيل') }}</h2>
          <p>
            {{ order.customerName }}<br />{{ order.address }}<br /><bdi>{{
              order.customerPhone
            }}</bdi
            ><br /><bdi>{{ order.customerEmail }}</bdi>
          </p>
        </section>
        <section class="account-section">
          <h2>{{ t('Payment', 'الدفع') }}</h2>
          <p>{{ customerStatus(order.paymentMethod) }}</p>
          <p>
            {{
              order.paymentStatus === 'pending'
                ? t('Payment pending', 'بانتظار الدفع')
                : customerStatus(order.paymentStatus)
            }}
          </p>
          <NuxtLink to="/contact" class="account-text-button">{{
            t('Need help with this order?', 'تحتاج مساعدة بشأن الطلب؟')
          }}</NuxtLink>
        </section>
      </div>
    </template>
  </AccountShell>
</template>
