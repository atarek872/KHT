<script setup lang="ts">
defineEmits<{ navigate: [] }>()

const navigation = [
  { label: 'Dashboard', to: '/admin' },
  { label: 'Orders', to: '/admin/orders' },
  { label: 'Products', to: '/admin/products' },
  { label: 'Inventory', to: '/admin/inventory' },
  { label: 'Categories', to: '/admin/categories' },
  { label: 'Customers', to: '/admin/customers' },
  { label: 'Discounts', to: '/admin/discounts' },
  { label: 'Shipping', to: '/admin/shipping' },
  { label: 'Abandoned Carts', to: '/admin/abandoned-carts' },
  { label: 'Settings' },
]
</script>

<template>
  <div class="admin-sidebar">
    <NuxtLink class="admin-sidebar__brand" to="/admin" aria-label="KHT Admin dashboard">
      <span class="admin-sidebar__wordmark">KHT</span>
      <span class="admin-sidebar__context">Admin</span>
    </NuxtLink>
    <span class="admin-sidebar__line" aria-hidden="true" />
    <nav class="admin-nav" aria-label="Admin navigation">
      <template v-for="item in navigation" :key="item.label">
        <NuxtLink
          v-if="item.to"
          :to="item.to"
          class="admin-nav__item"
          exact-active-class="admin-nav__item--active"
          @click="$emit('navigate')"
        >
          <span>{{ item.label }}</span>
        </NuxtLink>
        <span v-else class="admin-nav__item admin-nav__item--disabled" aria-disabled="true">
          <span>{{ item.label }}</span>
          <span class="sr-only">Not available yet</span>
        </span>
      </template>
    </nav>
    <p class="admin-sidebar__signature">Black. White. Line.</p>
  </div>
</template>