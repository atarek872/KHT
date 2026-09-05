<script setup lang="ts">
import type { DashboardRange, DashboardSnapshot } from '../../../shared/dashboard'
import DashboardMetric from '../../components/admin/dashboard/DashboardMetric.vue'
import DashboardSectionState from '../../components/admin/dashboard/DashboardSectionState.vue'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Dashboard — KHT Admin', robots: 'noindex, nofollow' })

const range = ref<DashboardRange>('7d')
const { data, error, status, refresh } = await useFetch<DashboardSnapshot>('/api/admin/dashboard', {
  query: { range },
  watch: [range],
})

const ranges: { label: string; value: DashboardRange }[] = [
  { label: 'Today', value: 'today' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
]

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(value)
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-EG', { month: 'short', day: 'numeric' }).format(
    new Date(`${value}T00:00:00Z`),
  )
</script>

<template>
  <div class="admin-shell__page admin-dashboard">
    <AdminPageHeader
      eyebrow="KHT / Operations"
      title="Dashboard"
      description="Commerce activity and operational priorities."
    >
      <template #actions>
        <div class="admin-dashboard__ranges" role="group" aria-label="Dashboard period">
          <button
            v-for="option in ranges"
            :key="option.value"
            type="button"
            :aria-pressed="range === option.value"
            @click="range = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </template>
    </AdminPageHeader>

    <div v-if="status === 'pending' && !data" class="admin-dashboard__loading" role="status">
      <AdminLoader label="Loading dashboard" />
      <div class="admin-dashboard__loading-grid" aria-hidden="true">
        <span v-for="index in 8" :key="index" />
      </div>
    </div>

    <AdminEmptyState
      v-else-if="error"
      title="Dashboard unavailable"
      description="The dashboard data could not be loaded. Check the server connection and try again."
    >
      <template #actions>
        <AdminButton :loading="status === 'pending'" loading-label="Retrying" @click="refresh()">
          Retry
        </AdminButton>
      </template>
    </AdminEmptyState>

    <template v-else-if="data">
      <section class="admin-dashboard__overview" aria-labelledby="dashboard-overview-title">
        <div class="admin-dashboard__section-heading">
          <div>
            <h2 id="dashboard-overview-title">Overview</h2>
            <p>{{ ranges.find((option) => option.value === data?.range)?.label }}</p>
          </div>
          <AdminLoader v-if="status === 'pending'" label="Updating" />
        </div>
        <div class="admin-dashboard__metrics">
          <DashboardMetric v-for="metric in data.metrics" :key="metric.key" :metric="metric" />
        </div>
      </section>

      <div class="admin-dashboard__primary-grid">
        <AdminSection title="Sales trend" description="Revenue over the selected period.">
          <ol v-if="data.salesTrend.items.length" class="admin-dashboard__data-list">
            <li v-for="item in data.salesTrend.items" :key="item.date">
              <time :datetime="item.date">{{ formatDate(item.date) }}</time>
              <strong>{{ formatCurrency(item.sales) }}</strong>
            </li>
          </ol>
          <DashboardSectionState
            v-else
            :availability="data.salesTrend.availability"
            :message="data.salesTrend.message"
          />
        </AdminSection>

        <AdminSection title="Recent orders" description="Latest orders requiring attention.">
          <div v-if="data.recentOrders.items.length" class="admin-dashboard__data-list">
            <NuxtLink
              v-for="order in data.recentOrders.items"
              :key="order.id"
              :to="`/admin/orders/${order.id}`"
            >
              <span>
                <strong>{{ order.number }}</strong>
                <small>{{ order.customerName }} · {{ order.fulfillmentStatus }}</small>
              </span>
              <strong>{{ formatCurrency(order.total) }}</strong>
            </NuxtLink>
          </div>
          <DashboardSectionState
            v-else
            :availability="data.recentOrders.availability"
            :message="data.recentOrders.message"
          />
        </AdminSection>
      </div>

      <div class="admin-dashboard__secondary-grid">
        <AdminSection title="Top products" description="Products ranked by items sold.">
          <ol v-if="data.topProducts.items.length" class="admin-dashboard__data-list">
            <li v-for="product in data.topProducts.items" :key="product.productName">
              <span>
                <strong>{{ product.productName }}</strong>
                <small>{{ product.quantity }} paid items</small>
              </span>
              <strong>{{ formatCurrency(product.revenue) }}</strong>
            </li>
          </ol>
          <DashboardSectionState
            v-else
            :availability="data.topProducts.availability"
            :message="data.topProducts.message"
          />
        </AdminSection>

        <AdminSection title="Low stock" description="Variants below the configured threshold.">
          <div v-if="data.lowStock.items.length" class="admin-dashboard__data-list">
            <NuxtLink
              v-for="variant in data.lowStock.items"
              :key="variant.id"
              to="/admin/inventory"
            >
              <span>
                <strong>{{ variant.productName }}</strong>
                <small>{{ variant.color }} / {{ variant.size }} · {{ variant.sku }}</small>
              </span>
              <strong>{{ variant.stock }} left</strong>
            </NuxtLink>
          </div>
          <DashboardSectionState
            v-else
            :availability="data.lowStock.availability"
            :message="data.lowStock.message"
          />
        </AdminSection>

        <AdminSection title="Abandoned carts" description="Carts and recovery activity.">
          <div v-if="data.abandonedCarts.items.length" class="admin-dashboard__cart-list">
            <NuxtLink
              v-for="cart in data.abandonedCarts.items"
              :key="cart.id"
              :to="`/admin/abandoned-carts/${cart.id}`"
            >
              <span>{{ cart.customerName || 'Anonymous cart' }}</span>
              <strong>{{ cart.itemsCount }} items</strong>
            </NuxtLink>
          </div>
          <DashboardSectionState
            v-else
            :availability="data.abandonedCarts.availability"
            :message="data.abandonedCarts.message"
          />
        </AdminSection>
      </div>
    </template>
  </div>
</template>
