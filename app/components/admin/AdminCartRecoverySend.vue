<script setup lang="ts">
import type { AbandonedCartSummary } from '../../../shared/abandonedCart'

const props = defineProps<{ cart: AbandonedCartSummary }>()
const emit = defineEmits<{ sent: [message: string] }>()
const open = ref(false)
const busy = ref(false)
const consentSource = ref('')
const error = ref('')
const available = computed(() =>
  Boolean(
    props.cart.email &&
    !props.cart.firstEmailState &&
    ['active', 'contacted'].includes(props.cart.recoveryState),
  ),
)
async function send() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const result = await $fetch<{ accepted: boolean; queued: boolean }>(
      `/api/admin/abandoned-carts/${encodeURIComponent(props.cart.id)}/send-recovery`,
      { method: 'POST', body: { consentSource: consentSource.value || undefined } },
    )
    open.value = false
    emit(
      'sent',
      result.accepted
        ? 'Brevo accepted the recovery email.'
        : 'Email queued for retry. Brevo did not accept it yet.',
    )
  } catch (cause: unknown) {
    error.value =
      (cause as { data?: { statusMessage?: string } }).data?.statusMessage ||
      'Could not send recovery email.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AdminButton
    type="button"
    variant="quiet"
    :disabled="!available"
    :title="
      !cart.email
        ? 'No email captured'
        : cart.firstEmailState
          ? `First reminder: ${cart.firstEmailState}`
          : 'Send recovery email'
    "
    @click="open = true"
    >{{ cart.firstEmailState ? 'Email ' + cart.firstEmailState : 'Send recovery' }}</AdminButton
  >
  <AdminModal :open="open" title="Send cart recovery email" @close="!busy && (open = false)">
    <p class="admin-modal__description">
      Send the first bilingual reminder to {{ cart.email }}. The customer receives a bag link,
      Instagram help link and unsubscribe link. This cart can receive the first reminder only once.
    </p>
    <p v-if="error" class="admin-create-order__error" role="alert">{{ error }}</p>
    <p v-if="cart.marketingConsentAt" class="admin-state-notice">
      Customer consent was recorded {{ new Date(cart.marketingConsentAt).toLocaleString('en-EG') }}.
    </p>
    <AdminTextarea
      v-else
      v-model="consentSource"
      label="Where did this customer agree to marketing email?"
      help="Required. Record a dated, verifiable source such as a checkout opt-in or an Instagram message. Do not send without permission."
      :rows="3"
      maxlength="500"
      required
    />
    <template #actions>
      <AdminButton variant="quiet" :disabled="busy" @click="open = false">Cancel</AdminButton>
      <AdminButton
        :loading="busy"
        :disabled="busy || (!cart.marketingConsentAt && consentSource.trim().length < 10)"
        @click="send"
        >Send via Brevo</AdminButton
      >
    </template>
  </AdminModal>
</template>
