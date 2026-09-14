<script setup lang="ts">
const { t } = useLanguage()
const { user } = useCustomer()
const { count } = useBag()
const route = useRoute()
const dialog = ref<HTMLDialogElement>()
const titleId = `welcome-gift-${useId()}`
const dismissalKey = 'kht-welcome-gift-dismissed-at'
const sessionKey = 'kht-welcome-gift-shown'
const dismissalWindow = 30 * 24 * 60 * 60 * 1000
let timer: ReturnType<typeof setTimeout> | undefined
let restoreFocus: HTMLElement | null = null

const returnTo = computed(() => (count.value ? '/checkout' : '/account'))
const registerTo = computed(() => ({
  path: '/account/register',
  query: { returnTo: returnTo.value },
}))
const loginTo = computed(() => ({ path: '/account/login', query: { returnTo: returnTo.value } }))

function routeAllowsPrompt(path: string) {
  return !/^\/(?:account|admin|cart|checkout|order-confirmation|track-order)(?:\/|$)/.test(path)
}

function recentlyDismissed() {
  const dismissedAt = Number(localStorage.getItem(dismissalKey) || 0)
  return dismissedAt > Date.now() - dismissalWindow
}

function close(markDismissed = true) {
  clearTimeout(timer)
  if (markDismissed) localStorage.setItem(dismissalKey, String(Date.now()))
  if (dialog.value?.open) dialog.value.close()
  document.body.style.overflow = ''
  restoreFocus?.focus()
}

function show() {
  if (user.value || !routeAllowsPrompt(route.path) || recentlyDismissed()) return
  if (sessionStorage.getItem(sessionKey) || dialog.value?.open) return
  sessionStorage.setItem(sessionKey, '1')
  restoreFocus = document.activeElement as HTMLElement
  dialog.value?.showModal()
  document.body.style.overflow = 'hidden'
}

function schedule() {
  clearTimeout(timer)
  if (user.value || !routeAllowsPrompt(route.path) || recentlyDismissed()) return
  const delay = matchMedia('(max-width: 767px)').matches ? 60_000 : 30_000
  timer = setTimeout(show, delay)
}

function claim() {
  localStorage.setItem(dismissalKey, String(Date.now()))
  close(false)
}

onMounted(schedule)
watch(
  () => [user.value?.id, route.path],
  () => {
    if (user.value || !routeAllowsPrompt(route.path)) close(false)
    else schedule()
  },
)
onBeforeUnmount(() => {
  clearTimeout(timer)
  document.body.style.overflow = ''
})
</script>

<template>
  <dialog
    ref="dialog"
    class="welcome-gift"
    :aria-labelledby="titleId"
    @cancel.prevent="close()"
    @click="(event) => event.target === dialog && close()"
  >
    <button
      class="icon-button welcome-gift-close"
      :aria-label="t('Close', 'إغلاق')"
      @click="close()"
    >
      <KhtIcon name="close" />
    </button>
    <div class="welcome-gift-mark" aria-hidden="true"><span>05</span><small>%</small></div>
    <p class="eyebrow">KHT / {{ t('WELCOME GIFT', 'هدية ترحيب') }}</p>
    <h2 :id="titleId">{{ t('YOUR FIRST ORDER. 5% OFF.', 'خصم ٥٪ على أول طلب.') }}</h2>
    <p>
      {{
        t(
          'Create your KHT account or sign in. Your welcome gift is applied automatically at checkout.',
          'أنشئ حساب KHT أو سجل دخولك، وهدية الترحيب هتتطبق تلقائياً عند إتمام الطلب.',
        )
      }}
    </p>
    <div class="welcome-gift-actions">
      <NuxtLink :to="registerTo" class="button button-dark" @click="claim">
        {{ t('Claim my gift', 'احصل على هديتي') }}<KhtIcon name="arrow" />
      </NuxtLink>
      <NuxtLink :to="loginTo" class="welcome-gift-login" @click="claim">
        {{ t('Already have an account? Sign in', 'عندك حساب؟ سجل دخولك') }}
      </NuxtLink>
    </div>
    <p class="welcome-gift-terms">
      {{ t('One use per customer. No code needed.', 'مرة واحدة لكل عميل، من غير كود.') }}
    </p>
  </dialog>
</template>
