<script setup lang="ts">
definePageMeta({ middleware: 'customer' })
const { t, money, locale } = useLanguage()
const page = ref(1)
interface Order {
  id: string
  number: string
  total: number
  paymentMethod: string
  paymentStatus: string
  fulfillmentStatus: string
  createdAt: string
}
const { data, status, error, refresh } = await useFetch<{ items: Order[]; hasMore: boolean }>(
  '/api/account/orders',
  { key: 'customer-orders', query: { page } },
)
const date = (value: string) =>
  new Date(value).toLocaleDateString(locale.value === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
</script>
<template>
  <AccountShell
    :title="t('YOUR ORDERS.', 'طلباتك.')"
    :intro="t('From the first line to your doorstep.', 'من أول خط حتى باب بيتك.')"
  >
    <p v-if="status === 'pending'" role="status">
      {{ t('Loading orders…', 'جاري تحميل الطلبات…') }}
    </p>
    <div v-else-if="error" role="alert" class="account-notice">
      {{ t('Could not load your orders.', 'تعذر تحميل طلباتك.') }}
      <button class="account-text-button" @click="refresh()">
        {{ t('Try again', 'حاول مجدداً') }}
      </button>
    </div>
    <template v-else
      ><div v-if="!data?.items.length" class="account-empty">
        <h2>{{ t('Your first chapter awaits.', 'فصلك الأول في انتظارك.') }}</h2>
        <p>
          {{
            t(
              'Orders placed while signed in will appear here.',
              'الطلبات التي تقدمها أثناء تسجيل الدخول ستظهر هنا.',
            )
          }}
        </p>
        <NuxtLink to="/shop" class="button button-dark"
          >{{ t('Explore the collection', 'اكتشف المجموعة') }}<KhtIcon name="arrow"
        /></NuxtLink>
      </div>
      <article v-for="order in data?.items" :key="order.id" class="account-order">
        <div class="account-row">
          <div>
            <p class="eyebrow">
              {{ t('ORDER', 'طلب') }} <bdi>{{ order.number }}</bdi>
            </p>
            <p class="muted">
              <time :datetime="order.createdAt">{{ date(order.createdAt) }}</time>
            </p>
          </div>
          <span class="account-badge">{{ customerStatus(order.fulfillmentStatus) }}</span>
        </div>
        <div class="account-row">
          <div>
            <strong>{{ money(order.total) }}</strong>
            <p class="account-help">
              {{ customerStatus(order.paymentMethod) }} ·
              {{
                order.paymentStatus === 'pending'
                  ? t('Payment pending', 'بانتظار الدفع')
                  : customerStatus(order.paymentStatus)
              }}
            </p>
          </div>
          <NuxtLink :to="`/account/orders/${order.id}`" class="account-text-button"
            >{{ t('View & track order', 'عرض وتتبع الطلب') }} <KhtIcon name="arrow"
          /></NuxtLink>
        </div></article
    ></template>
    <nav
      v-if="page > 1 || data?.hasMore"
      class="account-row account-pagination"
      :aria-label="t('Order pages', 'صفحات الطلبات')"
    >
      <button
        class="account-text-button"
        :disabled="page === 1 || status === 'pending'"
        @click="page--"
      >
        {{ t('Previous', 'السابق') }}</button
      ><span>{{ t('Page', 'صفحة') }} {{ page }}</span
      ><button
        class="account-text-button"
        :disabled="!data?.hasMore || status === 'pending'"
        @click="page++"
      >
        {{ t('Next', 'التالي') }}
      </button>
    </nav>
  </AccountShell>
</template>
