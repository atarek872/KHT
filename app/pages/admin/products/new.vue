<script setup lang="ts">
import type { AdminProductInput } from '../../../../shared/adminProduct'
import ProductForm from '../../../components/admin/products/ProductForm.vue'
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'New Product — KHT Admin', robots: 'noindex, nofollow' })
const busy = ref(false)
const error = ref('')
async function save(product: AdminProductInput) {
  if (busy.value) return
  busy.value = true; error.value = ''
  try { const created = await $fetch<{ id: string }>('/api/admin/products', { method: 'POST', body: product }); await navigateTo(`/admin/products/${created.id}`) }
  catch (cause: unknown) { error.value = (cause as { data?: { statusMessage?: string } }).data?.statusMessage || 'The product could not be created.' }
  finally { busy.value = false }
}
</script>
<template><div class="admin-shell__page admin-product-editor"><AdminPageHeader eyebrow="Products / New" title="New product" description="Create storefront content and sellable variants." /><ProductForm :busy="busy" :error="error" @submit="save" /></div></template>