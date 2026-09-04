<script setup lang="ts">
if (useRoute().params.slug !== '001')
  throw createError({ statusCode: 404, statusMessage: 'Drop not found' })
</script>
<template><CollectionView drop /></template>
