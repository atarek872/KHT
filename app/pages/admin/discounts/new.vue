<script setup lang="ts">
import type { DiscountInput } from '../../../../shared/discount'
import DiscountForm from '../../../components/admin/discounts/DiscountForm.vue'
definePageMeta({ layout: 'admin' }); useSeoMeta({ title: 'New Coupon — KHT Admin', robots: 'noindex, nofollow' })
const busy = ref(false); const error = ref('')
async function save(value: DiscountInput) { if (busy.value) return; busy.value = true; error.value = ''
  try { const created = await $fetch<{ id: string }>('/api/admin/discounts', { method: 'POST', body: value }); await navigateTo(`/admin/discounts/${created.id}`) }
  catch (cause: unknown) { error.value = (cause as { data?: { statusMessage?: string } }).data?.statusMessage || 'The coupon could not be created.' }
  finally { busy.value = false } }
</script>
<template><div class="admin-shell__page admin-discount-editor"><AdminPageHeader eyebrow="Discounts / New" title="New coupon" description="Create one enforceable order discount." /><DiscountForm :busy="busy" :error="error" @submit="save" /></div></template>