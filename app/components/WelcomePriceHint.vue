<script setup lang="ts">
import type { PublicWelcomeCampaignResponse } from '#shared/welcomeCampaign'
import { firstOrderWelcomePrice } from '#shared/welcomePrice'

const props = withDefaults(
  defineProps<{ price: number; productSlug: string; compact?: boolean; link?: boolean }>(),
  { link: true },
)
const { t, money } = useLanguage()
const { user } = useCustomer()
const { data } = useNuxtData<PublicWelcomeCampaignResponse>('welcome-campaign')
const campaign = computed(() => data.value?.campaign || null)
const eligible = computed(() => data.value?.eligibleForSignedInCustomer !== false)
const firstOrderPrice = computed(() =>
  eligible.value ? firstOrderWelcomePrice(props.price, campaign.value) : null,
)
const registerPath = computed(
  () => `/account/register?returnTo=${encodeURIComponent(`/products/${props.productSlug}`)}`,
)
</script>

<template>
  <p
    v-if="firstOrderPrice !== null"
    class="welcome-price-hint"
    :class="{ 'welcome-price-hint--compact': compact }"
  >
    <span
      >{{
        compact
          ? t('First order', 'أول طلب')
          : t('First signed-in order with', 'أول طلب بعد تسجيل الدخول بكود')
      }}
      <b>WELCOME10</b>:</span
    >
    <strong>{{ money(firstOrderPrice) }}</strong>
    <NuxtLink v-if="!user && link" :to="registerPath">{{
      compact ? t('Sign up', 'سجل حساب') : t('Create account', 'اعمل حساب')
    }}</NuxtLink>
    <small v-if="!compact">{{
      t(
        'If eligible · before delivery · verified at checkout',
        'عند استيفاء الشروط · قبل الشحن · يُؤكد عند إتمام الطلب',
      )
    }}</small>
  </p>
</template>
