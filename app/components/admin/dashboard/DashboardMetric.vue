<script setup lang="ts">
import type { DashboardMetric } from '../../../../shared/dashboard'

const props = defineProps<{ metric: DashboardMetric }>()

const displayValue = computed(() => {
  if (props.metric.value === null) return '—'
  if (props.metric.format === 'currency') {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0,
    }).format(props.metric.value)
  }
  return new Intl.NumberFormat('en-EG').format(props.metric.value)
})
</script>

<template>
  <article class="dashboard-metric" :data-availability="metric.availability">
    <p>{{ metric.label }}</p>
    <strong>{{ displayValue }}</strong>
    <span>{{ metric.availability === 'unavailable' ? 'Not available' : metric.note }}</span>
  </article>
</template>