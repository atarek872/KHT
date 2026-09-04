<script setup lang="ts">
defineProps<{ label: string; compact?: boolean }>()
</script>

<template>
  <div class="admin-table-region" role="region" :aria-label="label" tabindex="0">
    <table class="admin-table" :class="{ 'admin-table--compact': compact }">
      <slot />
    </table>
  </div>
</template>