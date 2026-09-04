<script setup lang="ts">
import type { Discount, DiscountInput } from '../../../../shared/discount'
definePageMeta({ layout: 'admin' }); useSeoMeta({ title: 'Discounts — KHT Admin', robots: 'noindex, nofollow' })
const { data, error, status, refresh } = await useFetch<Discount[]>('/api/admin/discounts')
const saving = ref(''); const message = ref(''); const messageError = ref(false)
const money = (value: number) => new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(value)
const rule = (discount: Discount) => discount.type === 'percentage' ? `${discount.value}% off` : `${money(discount.value)} off`
const date = (value?: string | null) => value ? new Intl.DateTimeFormat('en-EG', { dateStyle: 'medium' }).format(new Date(value)) : 'No limit'
async function toggle(discount: Discount) { if (saving.value) return; saving.value = discount.id; message.value = ''
  const body: DiscountInput = { code: discount.code, type: discount.type, value: discount.value,
    minimumOrder: discount.minimumOrder, maximumDiscount: discount.maximumDiscount,
    usageLimit: discount.usageLimit, validFrom: discount.validFrom, validUntil: discount.validUntil,
    active: !discount.active }
  try { await $fetch(`/api/admin/discounts/${discount.id}`, { method: 'PATCH', body }); await refresh(); messageError.value = false; message.value = `Coupon ${body.active ? 'enabled' : 'disabled'}.` }
  catch { messageError.value = true; message.value = 'The coupon status could not be updated.' } finally { saving.value = '' } }
</script>
<template><div class="admin-shell__page admin-discounts-page"><AdminPageHeader eyebrow="KHT / Commerce" title="Discounts" description="Simple order-level coupon rules.">
  <template #actions><NuxtLink to="/admin/discounts/new" class="admin-button admin-button--primary">New coupon <KhtIcon name="arrow" /></NuxtLink></template></AdminPageHeader>
  <p v-if="message" :class="messageError ? 'admin-create-order__error' : 'admin-state-notice'" :role="messageError ? 'alert' : 'status'">{{ message }}</p>
  <div v-if="status === 'pending' && !data" class="admin-orders-loading" role="status"><AdminLoader label="Loading discounts" /><span /></div>
  <AdminEmptyState v-else-if="error" title="Discounts unavailable" description="Coupon rules could not be loaded."><template #actions><AdminButton @click="refresh()">Retry</AdminButton></template></AdminEmptyState>
  <AdminEmptyState v-else-if="!data?.length" title="No coupons yet" description="Create a coupon when a simple order discount is needed." />
  <div v-else class="admin-discount-list"><article v-for="discount in data" :key="discount.id" class="admin-discount-row">
    <div><strong>{{ discount.code }}</strong><span>{{ rule(discount) }}</span></div>
    <dl><div><dt>Usage</dt><dd>{{ discount.currentUsage }} / {{ discount.usageLimit ?? 'Unlimited' }} used</dd></div>
      <div><dt>Minimum</dt><dd>{{ discount.minimumOrder ? money(discount.minimumOrder) : 'None' }}</dd></div>
      <div><dt>Valid until</dt><dd>{{ date(discount.validUntil) }}</dd></div></dl>
    <AdminBadge :tone="discount.active ? 'strong' : 'neutral'">{{ discount.active ? 'Active' : 'Inactive' }}</AdminBadge>
    <div class="admin-discount-row__actions"><NuxtLink :to="`/admin/discounts/${discount.id}`" class="admin-button admin-button--quiet">Edit</NuxtLink>
      <AdminButton variant="secondary" :loading="saving === discount.id" loading-label="Saving" @click="toggle(discount)">{{ discount.active ? 'Disable' : 'Enable' }}</AdminButton></div>
  </article></div>
</div></template>