<script setup lang="ts">
import type { DashboardAvailability } from '../../../../shared/dashboard'

defineProps<{ availability: DashboardAvailability; message: string }>()
</script>

<template>
  <div class="dashboard-section-state" role="status">
    <span aria-hidden="true" />
    <strong>{{ availability === 'unavailable' ? 'Data unavailable' : 'No activity yet' }}</strong>
    <p>{{ message }}</p>
  </div>
</template>