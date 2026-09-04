<script setup lang="ts">
import type { AdminCategory, AdminCategoryInput } from '../../../../shared/adminCategory'
import CategoryForm from '../../../components/admin/categories/CategoryForm.vue'
definePageMeta({ layout: 'admin' })
const route = useRoute(); const id = computed(() => String(route.params.id || ''))
const { data: category, error: loadError, status, refresh } = await useFetch<AdminCategory>(() => `/api/admin/categories/${encodeURIComponent(id.value)}`)
const busy = ref(false); const error = ref(''); const success = ref('')
useSeoMeta({ title: () => category.value ? `${category.value.name.en} — KHT Admin` : 'Edit Category — KHT Admin', robots: 'noindex, nofollow' })
async function save(value: AdminCategoryInput) { if (busy.value) return; busy.value = true; error.value = ''; success.value = ''
  try { category.value = await $fetch<AdminCategory>(`/api/admin/categories/${id.value}`, { method: 'PATCH', body: value }); success.value = 'Category saved.' }
  catch (cause: unknown) { error.value = (cause as { data?: { statusMessage?: string } }).data?.statusMessage || 'The category could not be saved.' }
  finally { busy.value = false } }
</script>
<template><div class="admin-shell__page admin-category-editor"><AdminPageHeader eyebrow="Categories / Edit" :title="category?.name.en || 'Edit category'" description="Update storefront category presentation." />
  <div v-if="status === 'pending' && !category" class="admin-orders-loading" role="status"><AdminLoader label="Loading category" /><span /></div>
  <AdminEmptyState v-else-if="loadError" title="Category unavailable" description="The category could not be loaded."><template #actions><AdminButton @click="refresh()">Retry</AdminButton></template></AdminEmptyState>
  <p v-if="success" class="admin-state-notice" role="status">{{ success }}</p>
  <CategoryForm v-if="category" :key="category.updatedAt" :initial="category" :busy="busy" :error="error" @submit="save" />
</div></template>