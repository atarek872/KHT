<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Discounts — KHT Admin', robots: 'noindex, nofollow' })
await navigateTo('/admin/discounts?view=welcome', { replace: true })
</script>

<template>
  <div class="admin-shell__page" />
</template>
