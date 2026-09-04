<script setup lang="ts">
withDefaults(defineProps<{ title: string; description?: string; live?: 'polite' | 'assertive' }>(), {
  description: undefined,
  live: 'polite',
})
</script>

<template>
  <div class="admin-empty-state" :role="live === 'assertive' ? 'alert' : 'status'" :aria-live="live">
    <span class="admin-empty-state__line" aria-hidden="true" />
    <h2>{{ title }}</h2>
    <p v-if="description">{{ description }}</p>
    <div v-if="$slots.actions" class="admin-empty-state__actions"><slot name="actions" /></div>
  </div>
</template>