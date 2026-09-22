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
const deleting = ref('')
const pendingDelete = ref<InventoryVariant | null>(null)
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
  if (!Number.isInteger(stock) || stock! < 0 || saving.value || deleting.value) return
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

function requestDelete(item: InventoryVariant) {
  message.value = ''
  pendingDelete.value = item
}

function closeDeleteDialog() {
  if (!deleting.value) pendingDelete.value = null
}

const deleteDescription = computed(() => {
  const item = pendingDelete.value
  if (!item) return ''
  return `${item.productName} · ${item.color} / ${item.size} · SKU ${item.sku} will be permanently deleted and removed from open carts. This cannot be undone.`
})

async function deleteSelectedVariant() {
  const item = pendingDelete.value
  if (!item || deleting.value || saving.value) return
  deleting.value = item.id
  message.value = ''
  try {
    const result = await $fetch<{
      deleted: true
      id: string
      removedFromCarts: number
      productArchived: boolean
    }>(`/api/admin/inventory/${encodeURIComponent(item.id)}`, { method: 'DELETE' })
    await refresh()
    delete drafts[item.id]
    pendingDelete.value = null
    messageError.value = false
    const cartNote = result.removedFromCarts
      ? ` Removed from ${result.removedFromCarts} open ${result.removedFromCarts === 1 ? 'cart' : 'carts'}.`
      : ''
    message.value = `${item.productName} · ${item.color} / ${item.size} deleted.${cartNote}${
      result.productArchived ? ' The product was archived because no active variants remain.' : ''
    }`
  } catch (cause: unknown) {
    const failure = cause as { data?: { statusMessage?: string } }
    messageError.value = true
    message.value = failure.data?.statusMessage || 'The variant could not be deleted. Refresh and try again.'
    await refresh()
  } finally {
    deleting.value = ''
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
        <td><div class="admin-inventory-row__actions">
          <AdminButton variant="quiet" :loading="saving === item.id" loading-label="Saving" :disabled="drafts[item.id] === item.stock || !!deleting" @click="saveStock(item)">Save</AdminButton>
          <button type="button" class="admin-delete-action" :aria-label="`Delete ${item.productName} ${item.color} ${item.size} ${item.sku} permanently`" :disabled="!!saving || !!deleting" @click="requestDelete(item)"><KhtIcon name="trash" /></button>
        </div></td>
      </tr></tbody></AdminTable></div>

      <div class="admin-inventory-mobile" aria-label="Variant inventory"><article v-for="item in data.items" :key="item.id" class="admin-inventory-card">
        <header><div><strong>{{ item.productName }}</strong><span>{{ item.color }} / {{ item.size }}</span></div><AdminBadge :tone="item.lowStock ? 'attention' : 'neutral'">{{ item.lowStock ? 'Low stock' : 'In stock' }}</AdminBadge></header>
        <dl><div><dt>SKU</dt><dd>{{ item.sku }}</dd></div><div><dt>Category</dt><dd>{{ item.category }}</dd></div></dl>
        <div class="admin-inventory-card__update"><label :for="`mobile-stock-${item.id}`">Available quantity</label>
          <input :id="`mobile-stock-${item.id}`" v-model.number="drafts[item.id]" type="number" min="0" step="1" />
          <div class="admin-inventory-card__actions">
            <AdminButton :loading="saving === item.id" loading-label="Saving" :disabled="drafts[item.id] === item.stock || !!deleting" @click="saveStock(item)">Save</AdminButton>
            <button type="button" class="admin-delete-action" :aria-label="`Delete ${item.productName} ${item.color} ${item.size} ${item.sku} permanently`" :disabled="!!saving || !!deleting" @click="requestDelete(item)"><KhtIcon name="trash" /></button>
          </div>
          <small>Whole numbers, minimum 0.</small></div>
      </article></div>
    </template>

    <AdminConfirmDialog
      :open="!!pendingDelete"
      title="Delete this inventory variant?"
      :description="deleteDescription"
      confirm-label="Delete permanently"
      danger
      :busy="!!deleting"
      @close="closeDeleteDialog"
      @confirm="deleteSelectedVariant"
    />
  </div>
</template>
