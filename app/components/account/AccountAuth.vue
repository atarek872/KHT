<script setup lang="ts">
const props = defineProps<{ mode: 'login' | 'register' | 'forgot-password' | 'reset-password' }>()
const { t } = useLanguage()
const route = useRoute()
const customer = useCustomer()
const form = reactive({ name: '', email: '', phone: '', password: '' })
const busy = ref(false),
  error = ref(''),
  done = ref(false),
  token = ref('')
const title = computed(() =>
  props.mode === 'register'
    ? t('MAKE IT YOURS.', 'حسابك. أسلوبك.')
    : props.mode === 'login'
      ? t('WELCOME BACK.', 'أهلاً بعودتك.')
      : t('RESET YOUR PASSWORD.', 'استعادة كلمة المرور.'),
)
onMounted(() => {
  if (props.mode === 'reset-password') {
    token.value = new URLSearchParams(globalThis.location.hash.slice(1)).get('token') || ''
    globalThis.history.replaceState(null, '', globalThis.location.pathname)
  }
})
async function submit() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    if (props.mode === 'login' || props.mode === 'register') {
      await customer.authenticate(props.mode, { ...form })
      await navigateTo(customerReturnTo(route.query.returnTo))
    } else if (props.mode === 'forgot-password') {
      await $fetch('/api/account/forgot-password', { method: 'POST', body: { email: form.email } })
      done.value = true
    } else {
      await $fetch('/api/account/reset-password', {
        method: 'POST',
        body: { token: token.value, password: form.password },
      })
      customer.user.value = null
      useBag().resetLocal()
      await navigateTo('/account/login?reset=1')
    }
  } catch (cause) {
    error.value = customerError(cause)
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <AccountShell
    :title="title"
    auth
    :intro="t('Your pieces. Your details. All in one place.', 'قطعك وبياناتك. كلها في مكان واحد.')"
  >
    <p v-if="done" role="status" class="account-notice">
      {{
        t(
          'If an account exists for this email, a password reset link will arrive shortly. Check your inbox and spam folder.',
          'إذا كان هناك حساب بهذا البريد، سيصلك رابط استعادة كلمة المرور قريباً. تحقق من البريد الوارد والرسائل غير المرغوبة.',
        )
      }}
    </p>
    <form v-else class="account-form" @submit.prevent="submit">
      <p v-if="route.query.reset" role="status">
        {{
          t(
            'Password updated. Sign in with your new password.',
            'تم تحديث كلمة المرور. سجل الدخول بكلمة المرور الجديدة.',
          )
        }}
      </p>
      <template v-if="mode === 'register'"
        ><label for="account-name">{{ t('Full name', 'الاسم بالكامل') }}</label
        ><input
          id="account-name"
          v-model="form.name"
          autocomplete="name"
          required
          maxlength="120" /><label for="account-phone">{{ t('Phone number', 'رقم الهاتف') }}</label
        ><input
          id="account-phone"
          v-model="form.phone"
          type="tel"
          autocomplete="tel"
          required
          maxlength="30"
      /></template>
      <template v-if="mode !== 'reset-password'"
        ><label for="account-email">{{ t('Email address', 'البريد الإلكتروني') }}</label
        ><input
          id="account-email"
          v-model="form.email"
          type="email"
          autocomplete="email"
          required
          maxlength="254"
          dir="ltr"
      /></template>
      <template v-if="mode !== 'forgot-password'"
        ><label for="account-password">{{
          mode === 'reset-password'
            ? t('New password', 'كلمة المرور الجديدة')
            : t('Password', 'كلمة المرور')
        }}</label
        ><input
          id="account-password"
          v-model="form.password"
          type="password"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          required
          :minlength="mode === 'login' ? 1 : 12"
          maxlength="128"
          :aria-describedby="mode !== 'login' ? 'password-help' : undefined"
        />
        <p v-if="mode !== 'login'" id="password-help" class="account-help">
          {{ t('Use at least 12 characters.', 'استخدم 12 حرفاً على الأقل.') }}
        </p></template
      >
      <p v-if="error" class="account-notice" role="alert">{{ error }}</p>
      <p v-if="mode === 'reset-password' && !token" role="status">
        {{
          t(
            'Open the complete reset link from your email to continue.',
            'افتح رابط الاستعادة الكامل من بريدك للمتابعة.',
          )
        }}
      </p>
      <button class="button button-dark" :disabled="busy || (mode === 'reset-password' && !token)">
        {{
          busy
            ? t('Please wait…', 'يرجى الانتظار…')
            : mode === 'login'
              ? t('Sign in', 'تسجيل الدخول')
              : mode === 'register'
                ? t('Create account', 'إنشاء حساب')
                : mode === 'forgot-password'
                  ? t('Send reset link', 'إرسال رابط الاستعادة')
                  : t('Save new password', 'حفظ كلمة المرور الجديدة')
        }}<KhtIcon name="arrow" />
      </button>
    </form>
    <div class="account-auth-links">
      <NuxtLink v-if="mode === 'login'" to="/account/forgot-password">{{
        t('Forgot password?', 'نسيت كلمة المرور؟')
      }}</NuxtLink
      ><NuxtLink
        v-if="mode === 'login'"
        :to="{
          path: '/account/register',
          query: { returnTo: customerReturnTo(route.query.returnTo) },
        }"
        >{{ t('New here? Create an account', 'أول زيارة؟ أنشئ حساباً') }}</NuxtLink
      ><NuxtLink
        v-else
        :to="{
          path: '/account/login',
          query: { returnTo: customerReturnTo(route.query.returnTo) },
        }"
        >{{ t('Back to sign in', 'العودة لتسجيل الدخول') }}</NuxtLink
      >
    </div>
  </AccountShell>
</template>
