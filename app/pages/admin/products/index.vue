<script setup lang="ts">
import type { AdminProductSummary } from '../../../../shared/adminProduct'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Products — KHT Admin', robots: 'noindex, nofollow' })
const { data, error, status, refresh } = await useFetch<AdminProductSummary[]>('/api/admin/products')
const actionProduct = ref<AdminProductSummary | null>(null)
const actionKind = ref<'deactivate' | 'reactivate' | null>(null)
const actionBusy = ref(false)
const actionError = ref('')
const actionMessage = ref('')
const money = (value: number) => new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(value)
const date = (value: string) => new Intl.DateTimeFormat('en-EG', { dateStyle: 'medium' }).format(new Date(value))

async function duplicate(product: AdminProductSummary) {
  actionError.value = ''
  actionMessage.value = ''
  try {
    const copy = await $fetch<AdminProductSummary>(`/api/admin/products/${product.id}/duplicate`, { method: 'POST' })
    await navigateTo(`/admin/products/${copy.id}`)
  } catch { actionError.value = 'The product could not be duplicated.' }
}

function openAction(product: AdminProductSummary, kind: 'deactivate' | 'reactivate') {
  actionProduct.value = product
  actionKind.value = kind
}

function closeAction() {
  if (actionBusy.value) return
  actionProduct.value = null
  actionKind.value = null
}

async function applyProductAction() {
  if (!actionProduct.value || !actionKind.value || actionBusy.value) return
  const kind = actionKind.value
  actionBusy.value = true
  actionError.value = ''
  actionMessage.value = ''
  try {
    const endpoint = kind === 'deactivate' ? 'archive' : 'activate'
    await $fetch(`/api/admin/products/${encodeURIComponent(actionProduct.value.id)}/${endpoint}`, {
      method: 'POST',
    })
    actionProduct.value = null
    actionKind.value = null
    await refresh()
    actionMessage.value = kind === 'deactivate' ? 'Product deactivated.' : 'Product reactivated.'
  } catch (cause: unknown) {
    const failure = cause as { data?: { statusMessage?: string } }
    actionError.value =
      failure.data?.statusMessage || `The product could not be ${kind}d.`
    actionProduct.value = null
    actionKind.value = null
  } finally {
    actionBusy.value = false
  }
}

const actionTitle = computed(() =>
  actionKind.value === 'reactivate' ? 'Reactivate product' : 'Deactivate product',
)
const actionDescription = computed(() =>
  actionKind.value === 'reactivate'
    ? `${actionProduct.value?.name.en || 'This product'} will return to the storefront with its existing variants and stock.`
    : `${actionProduct.value?.name.en || 'This product'} will be removed from the storefront. Variants and stock will be preserved.`,
)
const actionLabel = computed(() =>
  actionKind.value === 'reactivate' ? 'Reactivate' : 'Deactivate',
)
</script>

<template>
  <div class="admin-shell__page admin-products-page">
    <AdminPageHeader eyebrow="KHT / Catalog" title="Products" description="Scan availability, stock, and pricing.">
      <template #actions><NuxtLink to="/admin/products/new" class="admin-button admin-button--primary">New product <KhtIcon name="arrow" /></NuxtLink></template>
    </AdminPageHeader>
    <p v-if="actionError" class="admin-create-order__error" role="alert">{{ actionError }}</p>
    <p v-if="actionMessage" class="admin-state-notice" role="status">{{ actionMessage }}</p>
    <div v-if="status === 'pending' && !data" class="admin-orders-loading" role="status"><AdminLoader label="Loading products" /><span /></div>
    <AdminEmptyState v-else-if="error" title="Products unavailable" description="The catalog could not be loaded."><template #actions><AdminButton @click="refresh()">Retry</AdminButton></template></AdminEmptyState>
    <AdminEmptyState v-else-if="!data?.length" title="No products yet" description="Create the first product to begin the catalog." />
    <template v-else>
      <div class="admin-products-desktop"><AdminTable label="Products"><thead><tr><th scope="col">Image</th><th scope="col">Product</th><th scope="col">Category</th><th scope="col">Price</th><th scope="col">Stock</th><th scope="col">Status</th><th scope="col">Updated</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody><tr v-for="product in data" :key="product.id"><td><StoreImage :src="product.image" sizes="48px" :alt="product.name.en" /></td>
          <td><strong>{{ product.name.en }}</strong><span>{{ product.code }}</span></td><td>{{ product.category }}</td><td>{{ money(product.price) }}</td><td>{{ product.stock }}</td>
          <td><AdminBadge :tone="product.active ? 'strong' : 'neutral'">{{ product.active ? 'Active' : 'Inactive' }}</AdminBadge></td><td>{{ date(product.updatedAt) }}</td>
          <td><details class="admin-row-menu"><summary aria-label="Product actions"><KhtIcon name="menu" /></summary><div>
            <NuxtLink :to="`/admin/products/${product.id}`">Edit</NuxtLink><NuxtLink :to="`/products/${product.slug}`" target="_blank">View storefront</NuxtLink>
            <button type="button" @click="duplicate(product)">Duplicate</button><button v-if="product.active" type="button" @click="openAction(product, 'deactivate')">Deactivate</button><button v-if="!product.active" type="button" @click="openAction(product, 'reactivate')">Reactivate</button>
          </div></details></td></tr></tbody></AdminTable></div>
      <div class="admin-products-mobile"><article v-for="product in data" :key="product.id" class="admin-product-card"><StoreImage :src="product.image" sizes="72px" :alt="product.name.en" />
        <div><strong>{{ product.name.en }}</strong><span>{{ product.category }} · {{ product.code }}</span></div><dl><div><dt>Price</dt><dd>{{ money(product.price) }}</dd></div><div><dt>Stock</dt><dd>{{ product.stock }}</dd></div></dl>
        <div class="admin-product-card__actions"><NuxtLink :to="`/admin/products/${product.id}`" class="admin-button admin-button--secondary">Edit product</NuxtLink>
          <details class="admin-row-menu"><summary aria-label="Product actions"><KhtIcon name="menu" /></summary><div>
            <NuxtLink :to="`/products/${product.slug}`" target="_blank">View storefront</NuxtLink><button type="button" @click="duplicate(product)">Duplicate</button>
            <button v-if="product.active" type="button" @click="openAction(product, 'deactivate')">Deactivate</button><button v-if="!product.active" type="button" @click="openAction(product, 'reactivate')">Reactivate</button>
          </div></details></div></article></div>
    </template>
    <AdminConfirmDialog :open="!!actionProduct" :title="actionTitle" :description="actionDescription" :confirm-label="actionLabel" :danger="actionKind === 'deactivate'" :busy="actionBusy" @close="closeAction" @confirm="applyProductAction" />
  </div>
</template>
