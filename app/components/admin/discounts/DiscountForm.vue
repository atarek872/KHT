<script setup lang="ts">
import type { DiscountInput } from '../../../../shared/discount'

type DiscountFormState = Omit<DiscountInput, 'minimumOrder' | 'maximumDiscount' | 'usageLimit'> & {
  minimumOrder: number | ''
  maximumDiscount: number | ''
  usageLimit: number | ''
}

const props = defineProps<{ initial?: DiscountInput; busy?: boolean; error?: string }>()
const emit = defineEmits<{ submit: [value: DiscountInput] }>()
const localDate = (value?: string | null) => value ? new Date(value).toISOString().slice(0, 16) : ''
const form = reactive<DiscountFormState>({
  code: props.initial?.code || '', type: props.initial?.type || 'percentage',
  value: props.initial?.value || 10, minimumOrder: props.initial?.minimumOrder ?? '',
  maximumDiscount: props.initial?.maximumDiscount ?? '', usageLimit: props.initial?.usageLimit ?? '',
  validFrom: localDate(props.initial?.validFrom), validUntil: localDate(props.initial?.validUntil),
  active: props.initial?.active ?? true,
})

watch(() => form.type, (type) => { if (type === 'fixed') form.maximumDiscount = '' })

function submit() {
  emit('submit', {
    code: form.code.trim().toUpperCase(), type: form.type, value: Number(form.value),
    minimumOrder: form.minimumOrder === '' ? null : Number(form.minimumOrder),
    maximumDiscount: form.maximumDiscount === '' ? null : Number(form.maximumDiscount),
    usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
    validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : null,
    validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
    active: form.active,
  })
}
</script>

<template>
  <form class="admin-discount-form" @submit.prevent="submit">
    <AdminSection title="Coupon" description="One code and one order-level discount rule.">
      <div class="admin-discount-form__grid">
        <AdminInput v-model="form.code" label="Code" required placeholder="WELCOME10" autocapitalize="characters" />
        <AdminSelect v-model="form.type" label="Discount type" required>
          <option value="percentage">Percentage</option><option value="fixed">Fixed amount</option>
        </AdminSelect>
        <div class="admin-field"><label class="admin-field__label" for="discount-value">{{ form.type === 'percentage' ? 'Percentage' : 'Amount (EGP)' }}</label>
          <input id="discount-value" v-model.number="form.value" class="admin-field__control" type="number" min="1" :max="form.type === 'percentage' ? 100 : undefined" step="1" required /></div>
        <div class="admin-field"><label class="admin-field__label" for="discount-minimum">Minimum order (EGP) <span class="admin-field__optional">Optional</span></label>
          <input id="discount-minimum" v-model.number="form.minimumOrder" class="admin-field__control" type="number" min="1" step="1" /></div>
        <div v-if="form.type === 'percentage'" class="admin-field"><label class="admin-field__label" for="discount-maximum">Maximum discount (EGP) <span class="admin-field__optional">Optional</span></label>
          <input id="discount-maximum" v-model.number="form.maximumDiscount" class="admin-field__control" type="number" min="1" step="1" /></div>
        <div class="admin-field"><label class="admin-field__label" for="discount-limit">Usage limit <span class="admin-field__optional">Optional</span></label>
          <input id="discount-limit" v-model.number="form.usageLimit" class="admin-field__control" type="number" min="1" step="1" /></div>
        <div class="admin-field"><label class="admin-field__label" for="discount-from">Valid from <span class="admin-field__optional">Optional</span></label>
          <input id="discount-from" v-model="form.validFrom" class="admin-field__control" type="datetime-local" /></div>
        <div class="admin-field"><label class="admin-field__label" for="discount-until">Valid until <span class="admin-field__optional">Optional</span></label>
          <input id="discount-until" v-model="form.validUntil" class="admin-field__control" type="datetime-local" /></div>
        <AdminCheckbox v-model="form.active" label="Coupon active" />
      </div>
    </AdminSection>
    <p v-if="error" class="admin-create-order__error" role="alert">{{ error }}</p>
    <footer class="admin-product-form__actions"><NuxtLink to="/admin/discounts" class="admin-button admin-button--quiet">Cancel</NuxtLink>
      <AdminButton type="submit" :loading="busy" loading-label="Saving coupon">Save coupon</AdminButton></footer>
  </form>
</template>