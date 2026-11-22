<script setup lang="ts">
import type { DashboardAvailability } from '../../../../shared/dashboard'

defineProps<{ availability: DashboardAvailability; message: string }>()
</script>

<template>
  <div class="dashboard-section-state" role="status">
    <span aria-hidden="true" />
    <strong>{{
      availability === 'unavailable' ? 'البيانات غير متاحة' : 'لا يوجد نشاط بعد'
    }}</strong>
    <p>{{ message }}</p>
  </div>
</template>
