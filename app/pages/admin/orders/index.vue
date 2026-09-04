<script setup lang="ts">
import type { AdminOrderListResponse } from '../../../../shared/adminOrder'
import OrderStatus from '../../../components/admin/orders/OrderStatus.vue'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Orders — KHT Admin', robots: 'noindex, nofollow' })

const { data, error, status, refresh } = await useFetch<AdminOrderListResponse>('/api/admin/orders')
const money = (value: number) =>
  new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(value)
const date = (value: string) =>
  new Intl.DateTimeFormat('en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
</script>

<template>
  <div class="admin-shell__page admin-orders-page">
    <AdminPageHeader
      eyebrow="KHT / Operations"
      title="Orders"
      description="Review payments, fulfillment, and order sources."
    >
      <template #actions>
        <NuxtLink to="/admin/orders/new" class="admin-button admin-button--primary">
          Create order <KhtIcon name="arrow" />
        </NuxtLink>
      </template>
    </AdminPageHeader>

    <div v-if="status === 'pending' && !data" class="admin-orders-loading" role="status">
      <AdminLoader label="Loading orders" />
      <span aria-hidden="true" />
    </div>

    <AdminEmptyState
      v-else-if="error"
      title="Orders unavailable"
      description="Orders could not be loaded. Check the server connection and try again."
    >
      <template #actions>
        <AdminButton :loading="status === 'pending'" loading-label="Retrying" @click="refresh()">
          Retry
        </AdminButton>
      </template>
    </AdminEmptyState>

    <AdminEmptyState
      v-else-if="data?.availability === 'unavailable'"
      title="Order data unavailable"
      :description="data.message"
    />

    <AdminEmptyState
      v-else-if="data?.availability === 'empty' || !data?.items.length"
      title="No orders yet"
      description="Orders will appear here after durable checkout is enabled."
    />

    <template v-else-if="data">
      <div
        v-if="Object.values(data.capabilities).some(Boolean)"
        class="admin-orders-capabilities"
        aria-label="Order search and filters"
      >
        <p>Search and filters are provided only when supported by the order backend.</p>
      </div>

      <div class="admin-orders-desktop">
        <AdminTable label="Orders">
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Customer</th>
              <th scope="col">Total</th>
              <th scope="col">Payment</th>
              <th scope="col">Payment status</th>
              <th scope="col">Fulfillment</th>
              <th scope="col">Source</th>
              <th scope="col">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in data.items" :key="order.id">
              <td><NuxtLink :to="`/admin/orders/${order.id}`">{{ order.number }}</NuxtLink></td>
              <td>
                <strong>{{ order.customerName }}</strong>
                <span>{{ order.customerPhone }}</span>
              </td>
              <td>{{ money(order.total) }}</td>
              <td>{{ order.paymentMethod.toUpperCase() }}</td>
              <td><OrderStatus :value="order.paymentStatus" label="Payment status" /></td>
              <td>
                <OrderStatus :value="order.fulfillmentStatus" label="Fulfillment status" />
              </td>
              <td>{{ order.source }}</td>
              <td>{{ date(order.createdAt) }}</td>
            </tr>
          </tbody>
        </AdminTable>
      </div>

      <div class="admin-orders-mobile" aria-label="Orders">
        <NuxtLink
          v-for="order in data.items"
          :key="order.id"
          :to="`/admin/orders/${order.id}`"
          class="admin-order-card"
        >
          <div class="admin-order-card__heading">
            <strong>{{ order.number }}</strong>
            <span>{{ money(order.total) }}</span>
          </div>
          <div class="admin-order-card__customer">
            <strong>{{ order.customerName }}</strong>
            <span>{{ order.customerPhone }}</span>
          </div>
          <dl>
            <div><dt>Payment</dt><dd>{{ order.paymentMethod.toUpperCase() }}</dd></div>
            <div><dt>Payment status</dt><dd>{{ order.paymentStatus }}</dd></div>
            <div><dt>Fulfillment</dt><dd>{{ order.fulfillmentStatus }}</dd></div>
            <div><dt>Source</dt><dd>{{ order.source }}</dd></div>
          </dl>
          <time :datetime="order.createdAt">{{ date(order.createdAt) }}</time>
        </NuxtLink>
      </div>
    </template>
  </div>
</template>