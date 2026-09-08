<script setup lang="ts">
definePageMeta({ middleware: 'customer' })
const { t } = useLanguage()
const { user } = useCustomer()
const form = reactive({
  name: user.value?.name || '',
  email: user.value?.email || '',
  phone: user.value?.phone || '',
  currentPassword: '',
})
const passwords = reactive({ currentPassword: '', password: '' })
const busy = ref(''),
  error = ref(''),
  message = ref('')
async function save(kind: 'profile' | 'password') {
  if (busy.value) return
  busy.value = kind
  error.value = ''
  message.value = ''
  try {
    if (kind === 'profile') {
      const result = await $fetch<{ user: NonNullable<typeof user.value> }>(
        '/api/account/profile',
        { method: 'PATCH', body: form },
      )
      user.value = result.user
      form.currentPassword = ''
      message.value = t('Your details have been saved.', 'تم حفظ بياناتك.')
    } else {
      await useBag().flush()
      await $fetch('/api/account/password', { method: 'POST', body: passwords })
      user.value = null
      useBag().resetLocal()
      await navigateTo('/account/login?reset=1')
    }
  } catch (cause) {
    error.value = customerError(cause)
  } finally {
    busy.value = ''
  }
}
</script>
<template>
  <AccountShell
    :title="t('YOUR ACCOUNT.', 'حسابك.')"
    :intro="
      t(
        'Keep your details up to date for your next drop.',
        'حدّث بياناتك استعداداً لإصدارك القادم.',
      )
    "
  >
    <p v-if="error" role="alert" class="account-notice">{{ error }}</p>
    <p v-if="message" role="status" class="account-notice">{{ message }}</p>
    <section class="account-section">
      <h2>{{ t('Personal details', 'البيانات الشخصية') }}</h2>
      <form class="account-form" @submit.prevent="save('profile')">
        <label for="profile-name">{{ t('Full name', 'الاسم بالكامل') }}</label
        ><input
          id="profile-name"
          v-model="form.name"
          required
          autocomplete="name"
          maxlength="120"
        /><label for="profile-email">{{ t('Email address', 'البريد الإلكتروني') }}</label
        ><input
          id="profile-email"
          v-model="form.email"
          required
          type="email"
          autocomplete="email"
          maxlength="254"
          dir="ltr"
        /><label for="profile-phone">{{ t('Phone number', 'رقم الهاتف') }}</label
        ><input
          id="profile-phone"
          v-model="form.phone"
          required
          type="tel"
          autocomplete="tel"
          maxlength="30"
        /><template v-if="form.email !== user?.email"
          ><label for="profile-password">{{
            t('Current password to change email', 'كلمة المرور الحالية لتغيير البريد')
          }}</label
          ><input
            id="profile-password"
            v-model="form.currentPassword"
            required
            type="password"
            autocomplete="current-password" /></template
        ><button class="button button-dark" :disabled="!!busy">
          {{ busy === 'profile' ? t('Saving…', 'جاري الحفظ…') : t('Save details', 'حفظ البيانات') }}
        </button>
      </form>
    </section>
    <section class="account-section">
      <h2>{{ t('Password & security', 'كلمة المرور والأمان') }}</h2>
      <p class="muted">
        {{
          t(
            'Changing your password signs you out on every device.',
            'تغيير كلمة المرور يسجل خروجك من جميع الأجهزة.',
          )
        }}
      </p>
      <form class="account-form" @submit.prevent="save('password')">
        <label for="current-password">{{ t('Current password', 'كلمة المرور الحالية') }}</label
        ><input
          id="current-password"
          v-model="passwords.currentPassword"
          type="password"
          autocomplete="current-password"
          required
        /><label for="new-password">{{ t('New password', 'كلمة المرور الجديدة') }}</label
        ><input
          id="new-password"
          v-model="passwords.password"
          type="password"
          autocomplete="new-password"
          required
          minlength="12"
          maxlength="128"
          aria-describedby="new-password-help"
        />
        <p id="new-password-help" class="account-help">
          {{ t('Use at least 12 characters.', 'استخدم 12 حرفاً على الأقل.') }}
        </p>
        <button class="button button-dark" :disabled="!!busy">
          {{
            busy === 'password'
              ? t('Saving…', 'جاري الحفظ…')
              : t('Update password', 'تحديث كلمة المرور')
          }}
        </button>
      </form>
    </section>
  </AccountShell>
</template>
