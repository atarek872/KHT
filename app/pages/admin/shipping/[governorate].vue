<script setup lang="ts">
import type { ShippingZone, ShippingZoneInput } from '../../../../shared/shipping'
import ShippingZoneForm from '../../../components/admin/shipping/ShippingZoneForm.vue'
definePageMeta({ layout: 'admin' }); const route = useRoute(); const key = computed(() => String(route.params.governorate || ''))
const { data: zone, error: loadError, status, refresh } = await useFetch<ShippingZone>(() => `/api/admin/shipping/${encodeURIComponent(key.value)}`)
const busy = ref(false); const error = ref('')
const success = computed(() => route.query.saved === '1')
useSeoMeta({ title: () => zone.value ? `${zone.value.governorate} Shipping — KHT Admin` : 'Edit Shipping — KHT Admin', robots: 'noindex, nofollow' })
async function save(value: ShippingZoneInput) { if (busy.value) return; busy.value = true; error.value = ''
  try { const saved = await $fetch<ShippingZone>(`/api/admin/shipping/${encodeURIComponent(key.value)}`, { method: 'PATCH', body: value }); await navigateTo({ path: `/admin/shipping/${encodeURIComponent(saved.governorate)}`, query: { saved: '1' } }) }
  catch (cause: unknown) { error.value = (cause as { data?: { statusMessage?: string } }).data?.statusMessage || 'The shipping zone could not be saved.' }
  finally { busy.value = false } }
</script>
<template><div class="admin-shell__page admin-shipping-editor"><AdminPageHeader eyebrow="Shipping / Edit" :title="zone?.governorate || 'Edit shipping zone'" description="Update delivery availability and rate." />
  <div v-if="status === 'pending' && !zone" class="admin-orders-loading" role="status"><AdminLoader label="Loading shipping zone" /><span /></div>
  <AdminEmptyState v-else-if="loadError" title="Shipping zone unavailable" description="The shipping zone could not be loaded."><template #actions><AdminButton @click="refresh()">Retry</AdminButton></template></AdminEmptyState>
  <p v-if="success" class="admin-state-notice" role="status">Shipping rate saved.</p>
  <ShippingZoneForm v-if="zone" :key="zone.governorate" :initial="zone" :busy="busy" :error="error" @submit="save" />
</div></template>