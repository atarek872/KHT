<script setup lang="ts">
import type { AbandonedCartDetail } from '../../../../shared/abandonedCart'

definePageMeta({ layout: 'admin' })
const route = useRoute()
const id = computed(() => String(route.params.id || ''))
const { data: cart, error, status, refresh } = await useFetch<AbandonedCartDetail>(
  () => `/api/admin/abandoned-carts/${encodeURIComponent(id.value)}`,
)
const money = (value: number) => new Intl.NumberFormat('en-EG', {
  style: 'currency', currency: 'EGP', maximumFractionDigits: 0,
}).format(value)
const date = (value: string) => new Intl.DateTimeFormat('en-EG', {
  dateStyle: 'long', timeStyle: 'short',
}).format(new Date(value))
useSeoMeta({ title: 'Abandoned Cart — KHT Admin', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="admin-shell__page admin-abandoned-detail">
    <NuxtLink to="/admin/abandoned-carts" class="admin-order-back"><KhtIcon name="arrow" />Back to abandoned carts</NuxtLink>
    <div v-if="status === 'pending' && !cart" class="admin-orders-loading" role="status"><AdminLoader label="Loading cart" /><span /></div>
    <AdminEmptyState v-else-if="error" title="Cart unavailable" description="The cart could not be loaded."><template #actions><AdminButton @click="refresh()">Retry</AdminButton></template></AdminEmptyState>
    <template v-else-if="cart">
      <AdminPageHeader eyebrow="Abandoned cart" :title="cart.customerName || 'Anonymous cart'" :description="`Last activity ${date(cart.lastActivity)}`" />
      <div class="admin-abandoned-detail__grid"><div class="admin-abandoned-detail__main">
        <AdminSection title="Products" :description="`${cart.itemsCount} items · ${money(cart.subtotal)}`">
          <div class="admin-abandoned-items"><div v-for="item in cart.items" :key="item.id">
            <StoreImage :src="item.image" sizes="58px" :alt="item.productName" /><div><strong>{{ item.productName }}</strong><span>{{ item.variant }}</span></div>
            <span>{{ item.quantity }} × {{ money(item.unitPrice) }}</span><strong>{{ money(item.total) }}</strong>
          </div></div>
        </AdminSection>
      </div><aside>
        <AdminSection title="Contact"><dl class="admin-order-facts"><div><dt>Name</dt><dd>{{ cart.customerName || 'Not captured' }}</dd></div>
          <div><dt>Phone</dt><dd>{{ cart.phone || 'Not captured' }}</dd></div><div><dt>Email</dt><dd>{{ cart.email || 'Not captured' }}</dd></div></dl></AdminSection>
        <AdminSection title="Recovery"><div class="admin-recovery-state"><AdminBadge :tone="cart.recoveryState === 'recovered' ? 'strong' : 'neutral'">{{ cart.recoveryState === 'unavailable' ? 'Unavailable' : cart.recoveryState }}</AdminBadge>
          <p v-if="cart.recoveryState === 'unavailable'">No contact was captured. WhatsApp and email recovery are not configured.</p>
          <p v-else>Recovery status is recorded by the cart data source.</p></div></AdminSection>
        <AdminSection title="Activity"><dl class="admin-order-facts"><div><dt>Created</dt><dd>{{ date(cart.createdAt) }}</dd></div><div><dt>Last activity</dt><dd>{{ date(cart.lastActivity) }}</dd></div></dl></AdminSection>
      </aside></div>
    </template>
  </div>
</template>