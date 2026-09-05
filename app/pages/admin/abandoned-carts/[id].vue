<script setup lang="ts">
import type { AbandonedCartDetail, CartRecoveryState } from '../../../../shared/abandonedCart'

definePageMeta({ layout: 'admin' })
const route = useRoute()
const id = computed(() => String(route.params.id || ''))
const { data: cart, error, status, refresh } = await useFetch<AbandonedCartDetail>(
  () => `/api/admin/abandoned-carts/${encodeURIComponent(id.value)}`,
)
const saving = ref(false)
const actionError = ref('')
const actionMessage = ref('')
const whatsappLink = computed(() => cart.value?.phone
  ? `https://wa.me/${cart.value.phone.replace(/\D/g, '')}` : '')
const emailLink = computed(() => cart.value?.email ? `mailto:${cart.value.email}` : '')
async function changeRecoveryState(recoveryState: CartRecoveryState) {
  if (saving.value) return
  saving.value = true
  actionError.value = ''
  actionMessage.value = ''
  try {
    await $fetch(`/api/admin/abandoned-carts/${encodeURIComponent(id.value)}`, {
      method: 'PATCH', body: { recoveryState },
    })
    await refresh()
    actionMessage.value = `Cart marked ${recoveryState}.`
  } catch (cause: unknown) {
    actionError.value = (cause as { data?: { statusMessage?: string } }).data?.statusMessage
      || 'The recovery state could not be updated.'
  } finally { saving.value = false }
}
const money = (value: number) => new Intl.NumberFormat('en-EG', {
  style: 'currency', currency: 'EGP', maximumFractionDigits: 0,
}).format(value)
const date = (value: string) => new Intl.DateTimeFormat('en-EG', {
  dateStyle: 'long', timeStyle: 'short',
}).format(new Date(value))
useSeoMeta({ title: 'Abandoned Cart — KHT Admin', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="admin-shell__page admin-abandoned-detail">
    <NuxtLink to="/admin/abandoned-carts" class="admin-order-back"><KhtIcon name="arrow" />Back to abandoned carts</NuxtLink>
    <div v-if="status === 'pending' && !cart" class="admin-orders-loading" role="status"><AdminLoader label="Loading cart" /><span /></div>
    <AdminEmptyState v-else-if="error" title="Cart unavailable" description="The cart could not be loaded."><template #actions><AdminButton @click="refresh()">Retry</AdminButton></template></AdminEmptyState>
    <template v-else-if="cart">
      <AdminPageHeader eyebrow="Abandoned cart" :title="cart.customerName || 'Anonymous cart'" :description="`Last activity ${date(cart.lastActivity)}`" />
      <div class="admin-abandoned-detail__grid"><div class="admin-abandoned-detail__main">
        <AdminSection title="Products" :description="`${cart.itemsCount} items · ${money(cart.subtotal)}`">
          <div class="admin-abandoned-items"><div v-for="item in cart.items" :key="item.id">
            <StoreImage :src="item.image" sizes="58px" :alt="item.productName" /><div><strong>{{ item.productName }}</strong><span>{{ item.variant }}</span></div>
            <span>{{ item.quantity }} × {{ money(item.unitPrice) }}</span><strong>{{ money(item.total) }}</strong>
          </div></div>
        </AdminSection>
      </div><aside>
        <AdminSection title="Contact"><dl class="admin-order-facts"><div><dt>Name</dt><dd>{{ cart.customerName || 'Not captured' }}</dd></div>
          <div><dt>Phone</dt><dd>{{ cart.phone || 'Not captured' }}</dd></div><div><dt>Email</dt><dd>{{ cart.email || 'Not captured' }}</dd></div></dl></AdminSection>
        <AdminSection title="Recovery"><div class="admin-recovery-state"><AdminBadge :tone="cart.recoveryState === 'recovered' ? 'strong' : 'neutral'">{{ cart.recoveryState }}</AdminBadge>
          <p v-if="actionError" class="admin-create-order__error" role="alert">{{ actionError }}</p>
          <p v-if="actionMessage" class="admin-state-notice" role="status">{{ actionMessage }}</p>
          <p v-if="!cart.phone && !cart.email">No contact was captured. This cart is visible for value analysis, but no contact action is available.</p>
          <div v-if="cart.phone || cart.email" class="admin-recovery-contact">
            <a v-if="cart.phone" :href="whatsappLink" target="_blank" rel="noopener">Open WhatsApp</a>
            <a v-if="cart.email" :href="emailLink">Send email</a>
            <div class="admin-recovery-actions">
              <AdminButton v-if="cart.recoveryState === 'active'" :disabled="saving" @click="changeRecoveryState('contacted')">Mark contacted</AdminButton>
              <AdminButton v-if="['active', 'contacted'].includes(cart.recoveryState)" variant="secondary" :disabled="saving" @click="changeRecoveryState('recovered')">Mark recovered</AdminButton>
              <AdminButton v-if="['active', 'contacted'].includes(cart.recoveryState)" variant="quiet" :disabled="saving" @click="changeRecoveryState('dismissed')">Dismiss</AdminButton>
            </div>
          </div></div></AdminSection>
        <AdminSection title="Activity"><dl class="admin-order-facts"><div><dt>Created</dt><dd>{{ date(cart.createdAt) }}</dd></div><div><dt>Last activity</dt><dd>{{ date(cart.lastActivity) }}</dd></div></dl>
          <ol v-if="cart.events.length" class="admin-order-timeline"><li v-for="event in cart.events" :key="event.id"><span aria-hidden="true" /><div><strong>{{ event.fromState || 'new' }} → {{ event.toState }}</strong><p v-if="event.note">{{ event.note }}</p><small>{{ event.actorEmail }} · {{ date(event.createdAt) }}</small></div></li></ol>
        </AdminSection>
      </aside></div>
    </template>
  </div>
</template>
