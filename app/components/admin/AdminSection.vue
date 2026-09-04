<script setup lang="ts">
defineProps<{ title?: string; description?: string }>()
</script>

<template>
  <section class="admin-section">
    <header v-if="title || description || $slots.actions" class="admin-section__header">
      <div>
        <h2 v-if="title">{{ title }}</h2>
        <p v-if="description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="admin-section__actions"><slot name="actions" /></div>
    </header>
    <div class="admin-section__body"><slot /></div>
  </section>
</template>