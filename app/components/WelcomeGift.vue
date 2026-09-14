<script setup lang="ts">
import type { PublicWelcomeCampaign } from '../../shared/welcomeCampaign'

const { t, localized } = useLanguage()
const { user } = useCustomer()
const route = useRoute()
const dialog = ref<HTMLDialogElement>()
const titleId = `welcome-gift-${useId()}`
const { data } = await useFetch<{ campaign: PublicWelcomeCampaign | null }>(
  '/api/storefront/welcome-campaign',
  { key: 'welcome-campaign' },
)
const campaign = computed(() => data.value?.campaign || null)
let timer: ReturnType<typeof setTimeout> | undefined
let restoreFocus: HTMLElement | null = null

const dismissalKey = computed(() => `kht-welcome-gift-dismissed:${campaign.value?.revision || ''}`)
const sessionKey = computed(() => `kht-welcome-gift-shown:${campaign.value?.revision || ''}`)
const offerMark = computed(() => {
  if (!campaign.value) return { value: '', unit: '' }
  return campaign.value.discount.type === 'percentage'
    ? { value: String(campaign.value.discount.value).padStart(2, '0'), unit: '%' }
    : {
        value: new Intl.NumberFormat('en-US').format(campaign.value.discount.value),
        unit: t('EGP', 'ج.م'),
      }
})
const campaignTerms = computed(() => {
  if (!campaign.value) return ''
  if (campaign.value.firstOrderOnly)
    return t('Valid on your first signed-in order.', 'صالح على أول طلب بعد تسجيل الدخول.')
  if (campaign.value.oncePerCustomer)
    return t('One use per signed-in customer.', 'استخدام واحد لكل عميل مسجل.')
  if (campaign.value.loginRequired)
    return t('Available to signed-in customers.', 'متاح للعملاء المسجلين.')
  return t('The offer is applied automatically at checkout.', 'يتم تطبيق العرض تلقائياً عند الدفع.')
})

function campaignRedirect(path: string) {
  return path.replaceAll('{current}', encodeURIComponent(route.fullPath))
}

function normalizedPagePath(path: string) {
  return path.length > 1 ? path.replace(/\/+$/, '') : '/'
}

function routeAllowsPrompt(path: string) {
  if (!campaign.value) return false
  if (/^\/(?:account|admin|cart|checkout|order-confirmation|track-order)(?:\/|$)/.test(path)) {
    return false
  }
  const currentPath = normalizedPagePath(path)
  return campaign.value.displayMode === 'home'
    ? currentPath === '/'
    : currentPath === normalizedPagePath(campaign.value.displayPath)
}

function recentlyDismissed() {
  if (!campaign.value) return true
  const dismissedAt = Number(localStorage.getItem(dismissalKey.value) || 0)
  return dismissedAt > Date.now() - campaign.value.dismissalDays * 24 * 60 * 60 * 1000
}

function close(markDismissed = true) {
  clearTimeout(timer)
  if (markDismissed) localStorage.setItem(dismissalKey.value, String(Date.now()))
  if (dialog.value?.open) dialog.value.close()
  document.body.style.overflow = ''
  restoreFocus?.focus()
}

function show() {
  if (!campaign.value || user.value || !routeAllowsPrompt(route.path) || recentlyDismissed()) return
  if (sessionStorage.getItem(sessionKey.value) || dialog.value?.open) return
  sessionStorage.setItem(sessionKey.value, '1')
  restoreFocus = document.activeElement as HTMLElement
  dialog.value?.showModal()
  document.body.style.overflow = 'hidden'
}

function schedule() {
  clearTimeout(timer)
  if (!campaign.value || user.value || !routeAllowsPrompt(route.path) || recentlyDismissed()) return
  const seconds = matchMedia('(max-width: 767px)').matches
    ? campaign.value.mobileDelaySeconds
    : campaign.value.desktopDelaySeconds
  timer = setTimeout(show, seconds * 1000)
}

function claim() {
  localStorage.setItem(dismissalKey.value, String(Date.now()))
  close(false)
}

onMounted(schedule)
watch(
  () => [user.value?.id, route.path, campaign.value?.revision],
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
    v-if="campaign"
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
    <div class="welcome-gift-mark" aria-hidden="true">
      <span>{{ offerMark.value }}</span
      ><small>{{ offerMark.unit }}</small>
    </div>
    <p class="eyebrow">{{ localized(campaign.eyebrow) }}</p>
    <h2 :id="titleId">{{ localized(campaign.title) }}</h2>
    <p>{{ localized(campaign.body) }}</p>
    <div class="welcome-gift-actions">
      <NuxtLink
        :to="campaignRedirect(campaign.primaryRedirect)"
        class="button button-dark"
        @click="claim"
      >
        {{ localized(campaign.primaryLabel) }}<KhtIcon name="arrow" />
      </NuxtLink>
      <NuxtLink
        :to="campaignRedirect(campaign.secondaryRedirect)"
        class="welcome-gift-login"
        @click="claim"
      >
        {{ localized(campaign.secondaryLabel) }}
      </NuxtLink>
    </div>
    <p class="welcome-gift-terms">{{ campaignTerms }}</p>
  </dialog>
</template>
