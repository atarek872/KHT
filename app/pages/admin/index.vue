<script setup lang="ts">
import type { DashboardRange, DashboardSnapshot } from '../../../shared/dashboard'
import DashboardMetric from '../../components/admin/dashboard/DashboardMetric.vue'
import DashboardSectionState from '../../components/admin/dashboard/DashboardSectionState.vue'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Dashboard — KHT Admin', robots: 'noindex, nofollow' })

const range = ref<DashboardRange>('7d')
const { data, error, status, refresh } = await useFetch<DashboardSnapshot>(
  '/api/admin/dashboard',
  {
    query: { range },
    watch: [range],
  },
)

const ranges: { label: string; value: DashboardRange }[] = [
  { label: 'Today', value: 'today' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
]
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
          <DashboardSectionState
            :availability="data.salesTrend.availability"
            :message="data.salesTrend.message"
          />
        </AdminSection>

        <AdminSection title="Recent orders" description="Latest orders requiring attention.">
          <DashboardSectionState
            :availability="data.recentOrders.availability"
            :message="data.recentOrders.message"
          />
        </AdminSection>
      </div>

      <div class="admin-dashboard__secondary-grid">
        <AdminSection title="Top products" description="Products ranked by items sold.">
          <DashboardSectionState
            :availability="data.topProducts.availability"
            :message="data.topProducts.message"
          />
        </AdminSection>

        <AdminSection title="Low stock" description="Variants below the configured threshold.">
          <DashboardSectionState
            :availability="data.lowStock.availability"
            :message="data.lowStock.message"
          />
        </AdminSection>

        <AdminSection title="Abandoned carts" description="Carts and recovery activity.">
          <div v-if="data.abandonedCarts.items.length" class="admin-dashboard__cart-list">
            <NuxtLink v-for="cart in data.abandonedCarts.items" :key="cart.id" :to="`/admin/abandoned-carts/${cart.id}`">
              <span>{{ cart.customerName || 'Anonymous cart' }}</span>
              <strong>{{ cart.itemsCount }} items</strong>
            </NuxtLink>
          </div>
          <DashboardSectionState v-else
            :availability="data.abandonedCarts.availability"
            :message="data.abandonedCarts.message"
          />
        </AdminSection>
      </div>
    </template>
  </div>
</template>