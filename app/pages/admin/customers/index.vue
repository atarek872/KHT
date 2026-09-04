<script setup lang="ts">
import type { AdminCustomerSummary } from '../../../../shared/adminCustomer'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Customers — KHT Admin', robots: 'noindex, nofollow' })
const searchDraft = ref('')
const query = ref('')
const { data, error, status, refresh } = await useFetch<{ items: AdminCustomerSummary[] }>(
  '/api/admin/customers',
  { query: { q: query }, watch: [query] },
)
const money = (value: number) => new Intl.NumberFormat('en-EG', {
  style: 'currency', currency: 'EGP', maximumFractionDigits: 0,
}).format(value)
const date = (value?: string) => value ? new Intl.DateTimeFormat('en-EG', { dateStyle: 'medium' }).format(new Date(value)) : 'No orders'
function search() { query.value = searchDraft.value.trim() }
</script>

<template>
  <div class="admin-shell__page admin-customers-page">
    <AdminPageHeader eyebrow="KHT / Operations" title="Customers" description="Contact details and order history." />
    <form class="admin-customer-search" role="search" @submit.prevent="search">
      <AdminInput v-model="searchDraft" label="Search customers" placeholder="Phone, name, or email" />
      <AdminButton type="submit" variant="secondary">Search</AdminButton>
    </form>
    <p class="admin-customer-search__priority">Search priority: phone, name, then email.</p>

    <div v-if="status === 'pending' && !data" class="admin-orders-loading" role="status"><AdminLoader label="Loading customers" /><span /></div>
    <AdminEmptyState v-else-if="error" title="Customers unavailable" description="Customer records could not be loaded."><template #actions><AdminButton @click="refresh()">Retry</AdminButton></template></AdminEmptyState>
    <AdminEmptyState v-else-if="!data?.items.length" title="No customers found" description="Customers appear after an admin order is created." />
    <template v-else-if="data">
      <div class="admin-customers-desktop"><AdminTable label="Customers"><thead><tr>
        <th scope="col">Name</th><th scope="col">Phone</th><th scope="col">Email</th>
        <th scope="col">Orders</th><th scope="col">Total spent</th><th scope="col">Last order</th>
      </tr></thead><tbody><tr v-for="customer in data.items" :key="customer.id">
        <td><NuxtLink :to="`/admin/customers/${customer.id}`">{{ customer.name }}</NuxtLink></td>
        <td dir="ltr">{{ customer.phone }}</td><td>{{ customer.email || '—' }}</td><td>{{ customer.ordersCount }}</td>
        <td>{{ money(customer.totalSpent) }}</td><td>{{ date(customer.lastOrderAt) }}</td>
      </tr></tbody></AdminTable></div>
      <div class="admin-customers-mobile" aria-label="Customers"><NuxtLink v-for="customer in data.items" :key="customer.id" :to="`/admin/customers/${customer.id}`" class="admin-customer-card">
        <header><strong>{{ customer.name }}</strong><span>{{ customer.phone }}</span></header>
        <p>{{ customer.email || 'No email' }}</p><dl><div><dt>Orders</dt><dd>{{ customer.ordersCount }}</dd></div>
          <div><dt>Total spent</dt><dd>{{ money(customer.totalSpent) }}</dd></div><div><dt>Last order</dt><dd>{{ date(customer.lastOrderAt) }}</dd></div></dl>
      </NuxtLink></div>
    </template>
  </div>
</template>