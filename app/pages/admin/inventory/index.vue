<script setup lang="ts">
import type { InventoryVariant } from '../../../../shared/inventory'
import type { AdminCategory } from '../../../../shared/adminCategory'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Inventory — KHT Admin', robots: 'noindex, nofollow' })

const searchDraft = ref('')
const query = ref('')
const category = ref('')
const lowStock = ref(false)
const drafts = reactive<Record<string, number>>({})
const saving = ref('')
const message = ref('')
const messageError = ref(false)
const { data: categories } = await useFetch<AdminCategory[]>('/api/admin/categories')
const { data, error, status, refresh } = await useFetch<{ items: InventoryVariant[] }>(
  '/api/admin/inventory',
  { query: { q: query, category, lowStock }, watch: [query, category, lowStock] },
)

watch(data, (value) => {
  for (const item of value?.items || []) drafts[item.id] = item.stock
}, { immediate: true })

function search() {
  query.value = searchDraft.value.trim()
}

async function saveStock(item: InventoryVariant) {
  const stock = drafts[item.id]
  if (!Number.isInteger(stock) || stock! < 0 || saving.value) return
  saving.value = item.id
  message.value = ''
  try {
    await $fetch(`/api/admin/inventory/${item.id}`, {
      method: 'PATCH',
      body: { stock, expectedStock: item.stock },
    })
    await refresh()
    messageError.value = false
    message.value = `${item.productName} · ${item.color} / ${item.size} updated.`
  } catch (cause: unknown) {
    const failure = cause as { data?: { statusMessage?: string } }
    messageError.value = true
    message.value = failure.data?.statusMessage || 'Stock could not be updated. Refresh and try again.'
    await refresh()
  } finally {
    saving.value = ''
  }
}
</script>

<template>
  <div class="admin-shell__page admin-inventory-page">
    <AdminPageHeader eyebrow="KHT / Catalog" title="Inventory" description="Stock by exact sellable variant." />

    <form class="admin-inventory-filters" role="search" @submit.prevent="search">
      <AdminInput v-model="searchDraft" label="Search inventory" placeholder="Product, SKU, size, or color" />
      <AdminSelect v-model="category" label="Category">
        <option value="">All categories</option>
        <option v-for="option in categories || []" :key="option.id" :value="option.slug">{{ option.name.en }}</option>
      </AdminSelect>
      <AdminCheckbox v-model="lowStock" label="Low stock only" />
      <AdminButton type="submit" variant="secondary">Search</AdminButton>
    </form>

    <p v-if="message" class="admin-inventory-message" :class="{ 'admin-inventory-message--error': messageError }" :role="messageError ? 'alert' : 'status'">{{ message }}</p>

    <div v-if="status === 'pending' && !data" class="admin-orders-loading" role="status"><AdminLoader label="Loading inventory" /><span /></div>
    <AdminEmptyState v-else-if="error" title="Inventory unavailable" description="Inventory could not be loaded."><template #actions><AdminButton @click="refresh()">Retry</AdminButton></template></AdminEmptyState>
    <AdminEmptyState v-else-if="!data?.items.length" title="No variants found" description="Adjust the search or inventory filters." />
    <template v-else-if="data">
      <div class="admin-inventory-desktop"><AdminTable label="Variant inventory"><thead><tr>
        <th scope="col">Product</th><th scope="col">Variant</th><th scope="col">SKU</th><th scope="col">Category</th>
        <th scope="col">Available</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Update</span></th>
      </tr></thead><tbody><tr v-for="item in data.items" :key="item.id">
        <td><strong>{{ item.productName }}</strong></td><td>{{ item.color }} / {{ item.size }}</td><td>{{ item.sku }}</td><td>{{ item.category }}</td>
        <td><input v-model.number="drafts[item.id]" type="number" min="0" step="1" :aria-label="`Available stock for ${item.productName} ${item.color} ${item.size}`" /></td>
        <td><AdminBadge :tone="item.lowStock ? 'attention' : 'neutral'">{{ item.lowStock ? 'Low stock' : 'In stock' }}</AdminBadge><span v-if="!item.active" class="admin-inventory-inactive">Inactive</span></td>
        <td><AdminButton variant="quiet" :loading="saving === item.id" loading-label="Saving" :disabled="drafts[item.id] === item.stock" @click="saveStock(item)">Save</AdminButton></td>
      </tr></tbody></AdminTable></div>

      <div class="admin-inventory-mobile" aria-label="Variant inventory"><article v-for="item in data.items" :key="item.id" class="admin-inventory-card">
        <header><div><strong>{{ item.productName }}</strong><span>{{ item.color }} / {{ item.size }}</span></div><AdminBadge :tone="item.lowStock ? 'attention' : 'neutral'">{{ item.lowStock ? 'Low stock' : 'In stock' }}</AdminBadge></header>
        <dl><div><dt>SKU</dt><dd>{{ item.sku }}</dd></div><div><dt>Category</dt><dd>{{ item.category }}</dd></div></dl>
        <div class="admin-inventory-card__update"><label :for="`mobile-stock-${item.id}`">Available quantity</label>
          <input :id="`mobile-stock-${item.id}`" v-model.number="drafts[item.id]" type="number" min="0" step="1" />
          <AdminButton :loading="saving === item.id" loading-label="Saving" :disabled="drafts[item.id] === item.stock" @click="saveStock(item)">Save</AdminButton>
          <small>Whole numbers, minimum 0.</small></div>
      </article></div>
    </template>
  </div>
</template>