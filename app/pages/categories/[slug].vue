<script setup lang="ts">
const route = useRoute()
</script>
<template>
  <CollectionView :key="String(route.params.slug)" :category="String(route.params.slug)" />
</template>
