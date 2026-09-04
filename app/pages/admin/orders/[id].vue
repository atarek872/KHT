<script setup lang="ts">
import type { AdminOrderDetailResponse } from '../../../../shared/adminOrder'
import OrderStatus from '../../../components/admin/orders/OrderStatus.vue'

definePageMeta({ layout: 'admin' })
const route = useRoute()
const orderId = computed(() => String(route.params.id || ''))
const { data, error, status, refresh } = await useFetch<AdminOrderDetailResponse>(
  () => `/api/admin/orders/${encodeURIComponent(orderId.value)}`,
)
const order = computed(() => data.value?.order || null)
const money = (value: number) =>
  new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(value)
const date = (value: string) =>
  new Intl.DateTimeFormat('en-EG', { dateStyle: 'long', timeStyle: 'short' }).format(
    new Date(value),
  )

useSeoMeta({
  title: () => (order.value ? `${order.value.number} — KHT Admin` : 'Order — KHT Admin'),
  robots: 'noindex, nofollow',
})
</script>

<template>
  <div class="admin-shell__page admin-order-detail-page">
    <NuxtLink to="/admin/orders" class="admin-order-back">
      <KhtIcon name="arrow" />
      Back to orders
    </NuxtLink>

    <div v-if="status === 'pending' && !data" class="admin-orders-loading" role="status">
      <AdminLoader label="Loading order" />
      <span aria-hidden="true" />
    </div>

    <AdminEmptyState
      v-else-if="error"
      title="Order unavailable"
      description="The order could not be loaded. Check the server connection and try again."
    >
      <template #actions>
        <AdminButton :loading="status === 'pending'" loading-label="Retrying" @click="refresh()">
          Retry
        </AdminButton>
      </template>
    </AdminEmptyState>

    <AdminEmptyState
      v-else-if="data?.availability !== 'available' || !order"
      title="Order data unavailable"
      :description="data?.message || 'This order is not available.'"
    />

    <template v-else>
      <AdminPageHeader
        eyebrow="Order details"
        :title="order.number"
        :description="date(order.createdAt)"
      />

      <div class="admin-order-detail__status" aria-label="Order statuses">
        <div>
          <span>Payment status</span>
          <OrderStatus :value="order.paymentStatus" />
        </div>
        <div>
          <span>Fulfillment status</span>
          <OrderStatus :value="order.fulfillmentStatus" />
        </div>
        <div><span>Payment method</span><strong>{{ order.paymentMethod.toUpperCase() }}</strong></div>
        <div><span>Source</span><strong>{{ order.source }}</strong></div>
      </div>

      <div class="admin-order-detail__grid">
        <div class="admin-order-detail__main">
          <AdminSection title="Products" description="Exact variants and quantities in this order.">
            <div class="admin-order-lines">
              <div v-for="line in order.lines" :key="line.id" class="admin-order-line">
                <div><strong>{{ line.productName }}</strong><span>{{ line.variant }}</span></div>
                <dl>
                  <div><dt>Quantity</dt><dd>{{ line.quantity }}</dd></div>
                  <div><dt>Unit price</dt><dd>{{ money(line.unitPrice) }}</dd></div>
                  <div><dt>Line total</dt><dd>{{ money(line.total) }}</dd></div>
                </dl>
              </div>
            </div>
          </AdminSection>

          <AdminSection v-if="order.notes" title="Notes">
            <p class="admin-order-notes">{{ order.notes }}</p>
          </AdminSection>
        </div>

        <aside class="admin-order-detail__aside">
          <AdminSection title="Customer">
            <dl class="admin-order-facts">
              <div><dt>Name</dt><dd>{{ order.customerName }}</dd></div>
              <div><dt>Phone</dt><dd dir="ltr">{{ order.customerPhone }}</dd></div>
              <div v-if="order.customerEmail"><dt>Email</dt><dd>{{ order.customerEmail }}</dd></div>
              <div><dt>Address</dt><dd>{{ order.address }}</dd></div>
            </dl>
          </AdminSection>

          <AdminSection title="Totals">
            <dl class="admin-order-totals">
              <div><dt>Subtotal</dt><dd>{{ money(order.subtotal) }}</dd></div>
              <div><dt>Shipping</dt><dd>{{ money(order.shipping) }}</dd></div>
              <div><dt>Discount<template v-if="order.discountCode"> · {{ order.discountCode }}</template></dt><dd>− {{ money(order.discount) }}</dd></div>
              <div><dt>Total</dt><dd>{{ money(order.total) }}</dd></div>
            </dl>
          </AdminSection>
        </aside>
      </div>
    </template>
  </div>
</template>