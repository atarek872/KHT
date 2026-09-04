<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: 'Loading' })
</script>

<template>
  <div class="admin-loader" role="status">
    <span class="admin-loader__track" aria-hidden="true"><span /></span>
    <span>{{ label }}</span>
  </div>
</template>