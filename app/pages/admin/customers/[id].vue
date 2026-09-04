<script setup lang="ts">
import type { AdminCustomerDetail } from '../../../../shared/adminCustomer'
import DashboardSectionState from '../../../components/admin/dashboard/DashboardSectionState.vue'
import OrderStatus from '../../../components/admin/orders/OrderStatus.vue'

definePageMeta({ layout: 'admin' })
const route = useRoute()
const id = computed(() => String(route.params.id || ''))
const { data: customer, error, status, refresh } = await useFetch<AdminCustomerDetail>(
  () => `/api/admin/customers/${encodeURIComponent(id.value)}`,
)
const money = (value: number) => new Intl.NumberFormat('en-EG', {
  style: 'currency', currency: 'EGP', maximumFractionDigits: 0,
}).format(value)
const date = (value: string) => new Intl.DateTimeFormat('en-EG', {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value))
useSeoMeta({ title: () => customer.value ? `${customer.value.name} — KHT Admin` : 'Customer — KHT Admin', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="admin-shell__page admin-customer-detail-page">
    <NuxtLink to="/admin/customers" class="admin-order-back"><KhtIcon name="arrow" />Back to customers</NuxtLink>
    <div v-if="status === 'pending' && !customer" class="admin-orders-loading" role="status"><AdminLoader label="Loading customer" /><span /></div>
    <AdminEmptyState v-else-if="error" title="Customer unavailable" description="The customer could not be loaded."><template #actions><AdminButton @click="refresh()">Retry</AdminButton></template></AdminEmptyState>
    <template v-else-if="customer">
      <AdminPageHeader eyebrow="Customer" :title="customer.name" :description="`Customer since ${date(customer.createdAt)}`" />
      <div class="admin-customer-metrics"><div><span>Orders</span><strong>{{ customer.ordersCount }}</strong></div>
        <div><span>Total spent</span><strong>{{ money(customer.totalSpent) }}</strong></div>
        <div><span>Last order</span><strong>{{ customer.lastOrderAt ? date(customer.lastOrderAt) : 'No orders' }}</strong></div></div>
      <div class="admin-customer-detail__grid">
        <div class="admin-customer-detail__main"><AdminSection title="Order history" description="Most recent orders first.">
          <div v-if="customer.orders.length" class="admin-customer-orders"><NuxtLink v-for="order in customer.orders" :key="order.id" :to="`/admin/orders/${order.id}`">
            <div><strong>{{ order.number }}</strong><span>{{ date(order.createdAt) }}</span></div><span>{{ money(order.total) }}</span>
            <OrderStatus :value="order.paymentStatus" label="Payment status" /><OrderStatus :value="order.fulfillmentStatus" label="Fulfillment status" />
          </NuxtLink></div><DashboardSectionState v-else availability="empty" message="This customer has no orders yet." />
        </AdminSection></div>
        <aside><AdminSection title="Contact information"><dl class="admin-order-facts">
          <div><dt>Name</dt><dd>{{ customer.name }}</dd></div><div><dt>Phone</dt><dd dir="ltr">{{ customer.phone }}</dd></div>
          <div><dt>Email</dt><dd>{{ customer.email || 'Not provided' }}</dd></div></dl></AdminSection>
          <AdminSection title="Address"><address class="admin-customer-address">{{ customer.address }}<br />{{ customer.city }}<br />{{ customer.governorate }}</address></AdminSection>
        </aside>
      </div>
    </template>
  </div>
</template>