<script setup lang="ts">
import type { Discount, DiscountInput } from '../../../../shared/discount'
import DiscountForm from '../../../components/admin/discounts/DiscountForm.vue'
definePageMeta({ layout: 'admin' }); const route = useRoute(); const id = computed(() => String(route.params.id || ''))
const { data: discount, error: loadError, status, refresh } = await useFetch<Discount>(() => `/api/admin/discounts/${encodeURIComponent(id.value)}`)
const busy = ref(false); const error = ref(''); const success = ref('')
useSeoMeta({ title: () => discount.value ? `${discount.value.code} — KHT Admin` : 'Edit Coupon — KHT Admin', robots: 'noindex, nofollow' })
async function save(value: DiscountInput) { if (busy.value) return; busy.value = true; error.value = ''; success.value = ''
  try { discount.value = await $fetch<Discount>(`/api/admin/discounts/${id.value}`, { method: 'PATCH', body: value }); success.value = 'Coupon saved.' }
  catch (cause: unknown) { error.value = (cause as { data?: { statusMessage?: string } }).data?.statusMessage || 'The coupon could not be saved.' }
  finally { busy.value = false } }
</script>
<template><div class="admin-shell__page admin-discount-editor"><AdminPageHeader eyebrow="Discounts / Edit" :title="discount?.code || 'Edit coupon'" :description="discount ? `${discount.currentUsage} uses` : 'Coupon rule'" />
  <div v-if="status === 'pending' && !discount" class="admin-orders-loading" role="status"><AdminLoader label="Loading coupon" /><span /></div>
  <AdminEmptyState v-else-if="loadError" title="Coupon unavailable" description="The coupon could not be loaded."><template #actions><AdminButton @click="refresh()">Retry</AdminButton></template></AdminEmptyState>
  <p v-if="success" class="admin-state-notice" role="status">{{ success }}</p>
  <DiscountForm v-if="discount" :key="discount.updatedAt" :initial="discount" :busy="busy" :error="error" @submit="save" />
</div></template>