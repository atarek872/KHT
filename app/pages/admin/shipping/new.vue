<script setup lang="ts">
import type { ShippingZoneInput } from '../../../../shared/shipping'
import ShippingZoneForm from '../../../components/admin/shipping/ShippingZoneForm.vue'
definePageMeta({ layout: 'admin' }); useSeoMeta({ title: 'New Shipping Zone — KHT Admin', robots: 'noindex, nofollow' })
const busy = ref(false); const error = ref('')
async function save(value: ShippingZoneInput) { if (busy.value) return; busy.value = true; error.value = ''
  try { const created = await $fetch<ShippingZoneInput>('/api/admin/shipping', { method: 'POST', body: value }); await navigateTo(`/admin/shipping/${encodeURIComponent(created.governorate)}`) }
  catch (cause: unknown) { error.value = (cause as { data?: { statusMessage?: string } }).data?.statusMessage || 'The shipping zone could not be created.' }
  finally { busy.value = false } }
</script>
<template><div class="admin-shell__page admin-shipping-editor"><AdminPageHeader eyebrow="Shipping / New" title="New shipping zone" description="Add one supported destination and rate." /><ShippingZoneForm :busy="busy" :error="error" @submit="save" /></div></template>