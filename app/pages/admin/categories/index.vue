<script setup lang="ts">
import type { AdminCategory, AdminCategoryInput } from '../../../../shared/adminCategory'
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Categories — KHT Admin', robots: 'noindex, nofollow' })
const { data, error, status, refresh } = await useFetch<AdminCategory[]>('/api/admin/categories')
const saving = ref('')
const message = ref('')
const messageError = ref(false)
async function toggle(category: AdminCategory) {
  if (saving.value) return
  saving.value = category.id; message.value = ''
  const body: AdminCategoryInput = { slug: category.slug, name: category.name, image: category.image, active: !category.active, sortOrder: category.sortOrder }
  try { await $fetch(`/api/admin/categories/${category.id}`, { method: 'PATCH', body }); await refresh(); messageError.value = false; message.value = `Category ${body.active ? 'enabled' : 'disabled'}.` }
  catch { messageError.value = true; message.value = 'The category status could not be updated.' }
  finally { saving.value = '' }
}
</script>
<template><div class="admin-shell__page admin-categories-page"><AdminPageHeader eyebrow="KHT / Catalog" title="Categories" description="Organize storefront collections without code changes.">
  <template #actions><NuxtLink to="/admin/categories/new" class="admin-button admin-button--primary">New category <KhtIcon name="arrow" /></NuxtLink></template></AdminPageHeader>
  <p v-if="message" :class="messageError ? 'admin-create-order__error' : 'admin-state-notice'" :role="messageError ? 'alert' : 'status'">{{ message }}</p>
  <div v-if="status === 'pending' && !data" class="admin-orders-loading" role="status"><AdminLoader label="Loading categories" /><span /></div>
  <AdminEmptyState v-else-if="error" title="Categories unavailable" description="Categories could not be loaded."><template #actions><AdminButton @click="refresh()">Retry</AdminButton></template></AdminEmptyState>
  <AdminEmptyState v-else-if="!data?.length" title="No categories yet" description="Create the first storefront category." />
  <div v-else class="admin-category-list"><article v-for="category in data" :key="category.id" class="admin-category-row">
    <StoreImage :src="category.image" sizes="72px" :alt="category.name.en" /><div><strong>{{ category.name.en }}</strong><span>{{ category.name.ar }}</span></div>
    <dl><div><dt>Slug</dt><dd>{{ category.slug }}</dd></div><div><dt>Products</dt><dd>{{ category.productCount }}</dd></div><div><dt>Order</dt><dd>{{ category.sortOrder }}</dd></div></dl>
    <AdminBadge :tone="category.active ? 'strong' : 'neutral'">{{ category.active ? 'Active' : 'Inactive' }}</AdminBadge>
    <div class="admin-category-row__actions"><NuxtLink :to="`/admin/categories/${category.id}`" class="admin-button admin-button--quiet">Edit</NuxtLink>
      <AdminButton variant="secondary" :loading="saving === category.id" loading-label="Saving" @click="toggle(category)">{{ category.active ? 'Disable' : 'Enable' }}</AdminButton></div>
  </article></div>
</div></template>