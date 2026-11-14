<script setup lang="ts">
import type { RecoveryCopy } from '../../../../server/services/recoveryAdminSettings'

type Settings = {
  enabled: boolean
  senderEmail: string
  hasApiKey: boolean
  firstDelayMinutes: number
  secondDelayHours: number
  copy: RecoveryCopy
}
const { data, error, refresh } = await useFetch<Settings>('/api/admin/recovery-email')
const form = reactive<Settings>({
  enabled: false,
  senderEmail: '',
  hasApiKey: false,
  firstDelayMinutes: 60,
  secondDelayHours: 24,
  copy: {
    first: { subject: '', enTitle: '', enBody: '', arTitle: '', arBody: '' },
    second: { subject: '', enTitle: '', enBody: '', arTitle: '', arBody: '' },
  },
})
const credential = ref('')
const busy = ref(false)
const testing = ref(false)
const message = ref('')
const isError = ref(false)
watch(
  data,
  (value) => {
    if (value) Object.assign(form, structuredClone(value))
  },
  { immediate: true },
)
async function save() {
  busy.value = true
  message.value = ''
  try {
    await $fetch('/api/admin/recovery-email', {
      method: 'PUT',
      body: {
        enabled: form.enabled,
        senderEmail: form.senderEmail,
        credential: credential.value || undefined,
        firstDelayMinutes: Number(form.firstDelayMinutes),
        secondDelayHours: Number(form.secondDelayHours),
        copy: form.copy,
      },
    })
    credential.value = ''
    await refresh()
    isError.value = false
    message.value = 'Recovery email settings saved.'
  } catch (cause: unknown) {
    isError.value = true
    message.value =
      (cause as { data?: { statusMessage?: string } }).data?.statusMessage ||
      'Could not save settings.'
  } finally {
    busy.value = false
  }
}
async function sendTest() {
  testing.value = true
  message.value = ''
  try {
    await $fetch('/api/admin/recovery-email/test', { method: 'POST' })
    isError.value = false
    message.value = 'Brevo accepted a test email to the admin alert address. Check your inbox.'
  } catch (cause: unknown) {
    isError.value = true
    message.value =
      (cause as { data?: { statusMessage?: string } }).data?.statusMessage || 'Test email failed.'
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <div v-if="error" class="admin-create-order__error" role="alert">
    Recovery settings could not be loaded. <AdminButton @click="refresh()">Retry</AdminButton>
  </div>
  <form v-else class="admin-store-curtain__controls" @submit.prevent="save">
    <p
      v-if="message"
      :class="isError ? 'admin-create-order__error' : 'admin-state-notice'"
      :role="isError ? 'alert' : 'status'"
    >
      {{ message }}
    </p>
    <AdminSection
      title="Brevo connection"
      description="Create a Brevo account and verify the sender address, then enter your API key here. The key is encrypted and never shown again."
    >
      <div class="admin-store-curtain__grid">
        <AdminCheckbox
          v-model="form.enabled"
          label="Enable automatic cart recovery"
          help="Sends only to customers who opted in. Disabling also stops manual sends."
        />
        <AdminInput
          v-model="form.senderEmail"
          label="Verified sender email"
          type="email"
          placeholder="hello@your-domain.com"
          required
        />
        <AdminInput
          v-model="credential"
          label="Brevo API key"
          type="password"
          :placeholder="form.hasApiKey ? 'Saved — leave blank to keep it' : 'Paste API key'"
          autocomplete="new-password"
          :help="
            form.hasApiKey
              ? 'A key is saved. Enter a new one only to replace it.'
              : 'Create an API key in Brevo SMTP & API settings.'
          "
        />
      </div>
    </AdminSection>
    <AdminSection
      title="Timing"
      description="The first reminder goes after inactivity; the second goes after the set interval and only if the cart remains open."
    >
      <div class="admin-store-curtain__grid">
        <AdminInput
          v-model="form.firstDelayMinutes"
          label="First reminder after minutes"
          type="number"
          min="5"
          max="10080"
          required
        />
        <AdminInput
          v-model="form.secondDelayHours"
          label="Second reminder after hours"
          type="number"
          min="1"
          max="720"
          required
        />
      </div>
    </AdminSection>
    <AdminSection
      v-for="stage in ['first', 'second'] as const"
      :key="stage"
      :title="stage === 'first' ? 'First email' : 'Second email'"
      description="English and Arabic appear together in the message. Bag, Instagram and unsubscribe links are added automatically."
    >
      <div class="admin-store-curtain__grid">
        <AdminInput v-model="form.copy[stage].subject" label="Subject" maxlength="200" required />
        <AdminInput
          v-model="form.copy[stage].enTitle"
          label="English heading"
          maxlength="200"
          required
        />
        <AdminTextarea
          v-model="form.copy[stage].enBody"
          label="English message"
          maxlength="1000"
          required
        />
        <AdminInput
          v-model="form.copy[stage].arTitle"
          label="Arabic heading"
          dir="rtl"
          maxlength="200"
          required
        />
        <AdminTextarea
          v-model="form.copy[stage].arBody"
          label="Arabic message"
          dir="rtl"
          maxlength="1000"
          required
        />
      </div>
    </AdminSection>
    <div class="admin-store-curtain__actions">
      <AdminButton type="submit" :loading="busy" :disabled="busy">Save settings</AdminButton>
      <AdminButton
        type="button"
        variant="secondary"
        :loading="testing"
        :disabled="testing || !form.hasApiKey"
        @click="sendTest"
        >Send test to admin</AdminButton
      >
    </div>
  </form>
</template>
