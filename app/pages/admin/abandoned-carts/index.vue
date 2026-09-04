<script setup lang="ts">
import type { AbandonedCartSummary } from '../../../../shared/abandonedCart'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Abandoned Carts — KHT Admin', robots: 'noindex, nofollow' })
const { data, error, status, refresh } = await useFetch<{ items: AbandonedCartSummary[] }>('/api/admin/abandoned-carts')
const clock = ref(Date.now())
let clockTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => { clockTimer = setInterval(() => { clock.value = Date.now() }, 60000) })
onBeforeUnmount(() => clearInterval(clockTimer))
const money = (value: number) => new Intl.NumberFormat('en-EG', {
  style: 'currency', currency: 'EGP', maximumFractionDigits: 0,
}).format(value)
const date = (value: string) => new Intl.DateTimeFormat('en-EG', {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value))
function relative(value: string) {
  const minutes = Math.max(0, Math.floor((clock.value - new Date(value).getTime()) / 60000))
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.floor(hours / 24)} days ago`
}
</script>

<template>
  <div class="admin-shell__page admin-abandoned-page">
    <AdminPageHeader eyebrow="KHT / Operations" title="Abandoned carts" description="Carts inactive for at least 30 minutes." />
    <div v-if="status === 'pending' && !data" class="admin-orders-loading" role="status"><AdminLoader label="Loading abandoned carts" /><span /></div>
    <AdminEmptyState v-else-if="error" title="Abandoned carts unavailable" description="Cart activity could not be loaded."><template #actions><AdminButton @click="refresh()">Retry</AdminButton></template></AdminEmptyState>
    <AdminEmptyState v-else-if="!data?.items.length" title="No abandoned carts" description="Inactive carts will appear here after 30 minutes." />
    <template v-else-if="data">
      <div class="admin-abandoned-desktop"><AdminTable label="Abandoned carts"><thead><tr>
        <th scope="col">Customer</th><th scope="col">Value</th><th scope="col">Items</th>
        <th scope="col">Last activity</th><th scope="col">Recovery</th><th scope="col">Created</th>
      </tr></thead><tbody><tr v-for="cart in data.items" :key="cart.id">
        <td><NuxtLink :to="`/admin/abandoned-carts/${cart.id}`">{{ cart.customerName || 'Anonymous cart' }}</NuxtLink><span>{{ cart.phone || cart.email || 'No contact captured' }}</span></td>
        <td>{{ money(cart.subtotal) }}</td><td>{{ cart.itemsCount }}</td><td>{{ relative(cart.lastActivity) }}</td>
        <td><AdminBadge :tone="cart.recoveryState === 'recovered' ? 'strong' : 'neutral'">{{ cart.recoveryState === 'unavailable' ? 'Unavailable' : cart.recoveryState }}</AdminBadge></td>
        <td>{{ date(cart.createdAt) }}</td>
      </tr></tbody></AdminTable></div>
      <div class="admin-abandoned-mobile" aria-label="Abandoned carts"><NuxtLink v-for="cart in data.items" :key="cart.id" :to="`/admin/abandoned-carts/${cart.id}`" class="admin-abandoned-card">
        <header><strong>{{ cart.customerName || 'Anonymous cart' }}</strong><span>{{ money(cart.subtotal) }}</span></header>
        <p>{{ cart.phone || cart.email || 'No contact captured' }}</p><dl><div><dt>Items</dt><dd>{{ cart.itemsCount }}</dd></div>
          <div><dt>Last activity</dt><dd>{{ relative(cart.lastActivity) }}</dd></div><div><dt>Recovery</dt><dd>{{ cart.recoveryState === 'unavailable' ? 'Unavailable' : cart.recoveryState }}</dd></div></dl>
        <time :datetime="cart.createdAt">Created {{ date(cart.createdAt) }}</time>
      </NuxtLink></div>
    </template>
  </div>
</template>