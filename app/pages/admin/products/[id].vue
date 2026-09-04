<script setup lang="ts">
import type { AdminProduct, AdminProductInput } from '../../../../shared/adminProduct'
import ProductForm from '../../../components/admin/products/ProductForm.vue'
definePageMeta({ layout: 'admin' })
const route = useRoute()
const id = computed(() => String(route.params.id || ''))
const { data: product, error: loadError, status, refresh } = await useFetch<AdminProduct>(() => `/api/admin/products/${encodeURIComponent(id.value)}`)
const busy = ref(false); const error = ref(''); const success = ref('')
useSeoMeta({ title: () => product.value ? `${product.value.name.en} — KHT Admin` : 'Edit Product — KHT Admin', robots: 'noindex, nofollow' })
async function save(value: AdminProductInput) {
  if (busy.value) return
  busy.value = true; error.value = ''; success.value = ''
  try { product.value = await $fetch<AdminProduct>(`/api/admin/products/${id.value}`, { method: 'PATCH', body: value }); success.value = 'Product saved.' }
  catch (cause: unknown) { error.value = (cause as { data?: { statusMessage?: string } }).data?.statusMessage || 'The product could not be saved.' }
  finally { busy.value = false }
}
</script>
<template><div class="admin-shell__page admin-product-editor"><AdminPageHeader eyebrow="Products / Edit" :title="product?.name.en || 'Edit product'" description="Update storefront content and sellable variants." />
  <div v-if="status === 'pending' && !product" class="admin-orders-loading" role="status"><AdminLoader label="Loading product" /><span /></div>
  <AdminEmptyState v-else-if="loadError" title="Product unavailable" description="The product could not be loaded."><template #actions><AdminButton @click="refresh()">Retry</AdminButton></template></AdminEmptyState>
  <p v-if="success" class="admin-state-notice" role="status">{{ success }}</p>
  <ProductForm v-if="product" :key="product.updatedAt" :initial="product" :busy="busy" :error="error" @submit="save" />
</div></template>