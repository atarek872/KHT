<script setup lang="ts">
import type { AdminCategoryInput } from '../../../../shared/adminCategory'
import CategoryForm from '../../../components/admin/categories/CategoryForm.vue'
definePageMeta({ layout: 'admin' }); useSeoMeta({ title: 'New Category — KHT Admin', robots: 'noindex, nofollow' })
const busy = ref(false); const error = ref('')
async function save(value: AdminCategoryInput) { if (busy.value) return; busy.value = true; error.value = ''
  try { const created = await $fetch<{ id: string }>('/api/admin/categories', { method: 'POST', body: value }); await navigateTo(`/admin/categories/${created.id}`) }
  catch (cause: unknown) { error.value = (cause as { data?: { statusMessage?: string } }).data?.statusMessage || 'The category could not be created.' }
  finally { busy.value = false } }
</script>
<template><div class="admin-shell__page admin-category-editor"><AdminPageHeader eyebrow="Categories / New" title="New category" description="Create a storefront category." /><CategoryForm :busy="busy" :error="error" @submit="save" /></div></template>