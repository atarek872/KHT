<script setup lang="ts">
defineProps<{ title: string; description?: string; eyebrow?: string }>()
</script>

<template>
  <header class="admin-page-header">
    <div class="admin-page-header__copy">
      <p v-if="eyebrow" class="admin-page-header__eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p v-if="description" class="admin-page-header__description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="admin-page-header__actions"><slot name="actions" /></div>
  </header>
</template>