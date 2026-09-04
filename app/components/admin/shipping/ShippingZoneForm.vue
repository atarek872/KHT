<script setup lang="ts">
import type { ShippingZoneInput } from '../../../../shared/shipping'
const props = defineProps<{ initial?: ShippingZoneInput; busy?: boolean; error?: string }>()
const emit = defineEmits<{ submit: [value: ShippingZoneInput] }>()
const form = reactive<ShippingZoneInput>({
  governorate: props.initial?.governorate || '',
  rate: props.initial?.rate ?? 0,
  enabled: props.initial?.enabled ?? true,
})
</script>
<template><form class="admin-shipping-form" @submit.prevent="emit('submit', { ...form })">
  <AdminSection title="Shipping zone" description="One flat rate for a supported zone or governorate.">
    <div class="admin-shipping-form__fields"><AdminInput v-model="form.governorate" label="Zone / governorate" required placeholder="Cairo" />
      <div class="admin-field"><label class="admin-field__label" for="shipping-rate">Rate (EGP)</label>
        <input id="shipping-rate" v-model.number="form.rate" class="admin-field__control" type="number" min="0" step="1" required /></div>
      <AdminCheckbox v-model="form.enabled" label="Available at checkout" /></div>
  </AdminSection>
  <p v-if="error" class="admin-create-order__error" role="alert">{{ error }}</p>
  <footer class="admin-product-form__actions"><NuxtLink to="/admin/shipping" class="admin-button admin-button--quiet">Cancel</NuxtLink>
    <AdminButton type="submit" :loading="busy" loading-label="Saving rate">Save shipping rate</AdminButton></footer>
</form></template>