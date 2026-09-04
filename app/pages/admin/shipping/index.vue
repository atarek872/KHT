<script setup lang="ts">
import type { ShippingZone, ShippingZoneInput } from '../../../../shared/shipping'
definePageMeta({ layout: 'admin' }); useSeoMeta({ title: 'Shipping — KHT Admin', robots: 'noindex, nofollow' })
const { data, error, status, refresh } = await useFetch<{ items: ShippingZone[] }>('/api/admin/shipping')
const saving = ref(''); const message = ref(''); const messageError = ref(false)
const money = (value: number) => new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(value)
async function toggle(zone: ShippingZone) { if (saving.value) return; saving.value = zone.governorate; message.value = ''
  const body: ShippingZoneInput = { ...zone, enabled: !zone.enabled }
  try { await $fetch(`/api/admin/shipping/${encodeURIComponent(zone.governorate)}`, { method: 'PATCH', body }); await refresh(); messageError.value = false; message.value = `Shipping zone ${body.enabled ? 'enabled' : 'disabled'}.` }
  catch { messageError.value = true; message.value = 'The shipping zone could not be updated.' } finally { saving.value = '' } }
</script>
<template><div class="admin-shell__page admin-shipping-page"><AdminPageHeader eyebrow="KHT / Commerce" title="Shipping" description="Flat delivery rates by supported zone.">
  <template #actions><NuxtLink to="/admin/shipping/new" class="admin-button admin-button--primary">New zone <KhtIcon name="arrow" /></NuxtLink></template></AdminPageHeader>
  <p v-if="message" :class="messageError ? 'admin-create-order__error' : 'admin-state-notice'" :role="messageError ? 'alert' : 'status'">{{ message }}</p>
  <div v-if="status === 'pending' && !data" class="admin-orders-loading" role="status"><AdminLoader label="Loading shipping zones" /><span /></div>
  <AdminEmptyState v-else-if="error" title="Shipping unavailable" description="Shipping configuration could not be loaded."><template #actions><AdminButton @click="refresh()">Retry</AdminButton></template></AdminEmptyState>
  <AdminEmptyState v-else-if="!data?.items.length" title="No shipping zones" description="Create a zone before accepting orders." />
  <div v-else class="admin-shipping-list"><article v-for="zone in data.items" :key="zone.governorate" class="admin-shipping-row">
    <div><strong>{{ zone.governorate }}</strong><span>Delivery zone</span></div><div><span>Rate</span><strong>{{ money(zone.rate) }}</strong></div>
    <AdminBadge :tone="zone.enabled ? 'strong' : 'neutral'">{{ zone.enabled ? 'Enabled' : 'Disabled' }}</AdminBadge>
    <div class="admin-shipping-row__actions"><NuxtLink :to="`/admin/shipping/${encodeURIComponent(zone.governorate)}`" class="admin-button admin-button--quiet">Edit</NuxtLink>
      <AdminButton variant="secondary" :loading="saving === zone.governorate" loading-label="Saving" @click="toggle(zone)">{{ zone.enabled ? 'Disable' : 'Enable' }}</AdminButton></div>
  </article></div>
</div></template>