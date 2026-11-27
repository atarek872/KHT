<script setup lang="ts">
import { setSavingsForLines } from '#shared/setOffer'
import type { OrderQuote } from '#shared/discount'
import type { PublicWelcomeCampaign } from '#shared/welcomeCampaign'
import { discountErrorArabic } from '#shared/discountErrors'
import { firstOrderWelcomePrice } from '#shared/welcomePrice'
import { governorateLabel } from '#shared/governorate'
import type { StorefrontShippingZone } from '#shared/shipping'
const { t, money, locale } = useLanguage()
const { count, total, lines, recover, flush } = useBag()
const { user } = useCustomer()
const catalog = useCatalog()
const route = useRoute()
const recoveryError = ref('')
const appliedCode = useState('kht-checkout-coupon', () => '')
const codeInput = ref(appliedCode.value)
const quote = ref<OrderQuote | null>(null)
const offerBusy = ref(false)
const offerError = ref('')
let quoteRequest = 0
const { data: welcomeCampaignData } = await useFetch<{ campaign: PublicWelcomeCampaign | null }>(
  '/api/storefront/welcome-campaign',
  { key: 'welcome-campaign' },
)
const welcomeCampaign = computed(() => welcomeCampaignData.value?.campaign || null)
const guestWelcomePrice = computed(() => firstOrderWelcomePrice(total.value, welcomeCampaign.value))
const quotedSubtotal = computed(() => quote.value?.subtotal ?? total.value)
const discountedSubtotal = computed(() => quotedSubtotal.value - (quote.value?.discount || 0))
const governorate = useState('kht-shipping-governorate', () => '')
const { data: shippingData } = await useFetch<{
  items: StorefrontShippingZone[]
  freeShipping: boolean
}>('/api/shipping/options')
const shippingOptions = computed(() => shippingData.value?.items || [])
const selectedShipping = computed(() =>
  shippingOptions.value.find((option) => option.governorate === governorate.value),
)
watch(
  shippingOptions,
  (options) => {
    if (governorate.value && !options.some((option) => option.governorate === governorate.value))
      governorate.value = ''
  },
  { immediate: true },
)

async function checkOffer(code = appliedCode.value) {
  const request = ++quoteRequest
  quote.value = null
  offerError.value = ''
  if (!count.value) {
    offerBusy.value = false
    return
  }
  offerBusy.value = true
  try {
    const result = await $fetch<OrderQuote>('/api/discounts/quote', {
      method: 'POST',
      body: {
        code: code || undefined,
        shippingGovernorate: governorate.value || undefined,
        items: lines.value.map(({ id, size, quantity }) => ({ id, size, quantity })),
      },
    })
    if (request !== quoteRequest) return
    quote.value = result
    appliedCode.value = code ? result.couponCode || code : ''
    if (code) codeInput.value = appliedCode.value
  } catch (cause: unknown) {
    if (request !== quoteRequest) return
    const failure = cause as { statusCode?: number; data?: { statusMessage?: string } }
    const message = failure.data?.statusMessage || 'Coupon could not be applied.'
    offerError.value = t(message, discountErrorArabic(message))
    if (failure.statusCode === 400) appliedCode.value = ''
  } finally {
    if (request === quoteRequest) offerBusy.value = false
  }
}

function applyCode() {
  const code = codeInput.value.trim().toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) {
    offerError.value = t(
      'Use 3–32 letters, numbers, hyphens or underscores.',
      'اكتب كودًا من ٣ إلى ٣٢ حرفًا أو رقمًا، ويمكن استخدام - أو _.',
    )
    return
  }
  void checkOffer(code)
}

function removeCode() {
  appliedCode.value = ''
  codeInput.value = ''
  void checkOffer('')
}

watch(
  () => [
    user.value?.id,
    governorate.value,
    lines.value.map((line) => `${line.id}:${line.size}:${line.quantity}`).join('|'),
  ],
  () => {
    if (import.meta.client) void checkOffer()
  },
  { immediate: true },
)
onMounted(async () => {
  const campaignCode =
    typeof route.query.coupon === 'string' ? route.query.coupon.toUpperCase() : ''
  if (/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(campaignCode)) {
    appliedCode.value = campaignCode
    codeInput.value = campaignCode
    if (count.value) await checkOffer(campaignCode)
  }
  const token = route.hash.match(/^#recovery=([a-f0-9-]{72})$/i)?.[1]
  if (!token) return
  window.history.replaceState(null, '', route.path)
  try {
    const result = await $fetch<{ items: { id: string; size: string; quantity: number }[] }>(
      '/api/cart/recover',
      { method: 'POST', body: { token } },
    )
    if (!recover(result.items)) throw new Error('Unavailable selections')
    await flush()
  } catch {
    recoveryError.value = t(
      'This bag link is no longer available. Explore the collection to make a fresh selection.',
      'رابط السلة لم يعد متاحًا. تقدر تختار من المجموعة من جديد.',
    )
  }
})
const setSaving = computed(() => setSavingsForLines(catalog.value, lines.value))
useSeoMeta({ title: () => t('Your bag — KHT', 'سلتك — KHT') })
</script>
<template>
  <main id="main" class="commerce-page light-surface">
    <p v-if="recoveryError" class="checkout-guest-note" role="alert">{{ recoveryError }}</p>
    <div class="page-heading">
      <p class="eyebrow">KHT / {{ t('YOUR SELECTION', 'اختياراتك') }}</p>
      <h1>
        {{ t('YOUR BAG.', 'سلتك.') }}<sup>{{ count }}</sup>
      </h1>
    </div>
    <div v-if="count" class="commerce-grid">
      <BagItems />
      <aside class="order-summary">
        <h2>{{ t('A few good pieces.', 'قطع على ذوقك.') }}</h2>
        <div class="summary-row">
          <span>{{ t('Subtotal', 'المجموع الفرعي') }}</span
          ><span>{{ money(quotedSubtotal) }}</span>
        </div>
        <p v-if="setSaving" class="set-saving">
          {{
            t(
              `You save ${money(setSaving)} with the Full Set.`,
              `وفرت ${money(setSaving)} باختيار الطقم الكامل.`,
            )
          }}
        </p>
        <div v-if="quote?.discount" class="bag-offer-applied" role="status">
          <span class="eyebrow">KHT / {{ t('YOUR OFFER', 'عرضك') }}</span>
          <strong>{{ t('Your discount is applied.', 'خصمك اتطبق على السلة.') }}</strong>
          <span
            >{{ quote.couponCode }} · {{ t('You save', 'وفّرت') }} {{ money(quote.discount) }}</span
          >
        </div>
        <form class="bag-coupon" @submit.prevent="applyCode">
          <label for="bag-coupon-code">{{ t('Have a discount code?', 'معاك كود خصم؟') }}</label>
          <div>
            <input
              id="bag-coupon-code"
              v-model="codeInput"
              type="text"
              autocomplete="off"
              maxlength="32"
              :aria-invalid="Boolean(offerError)"
              aria-describedby="bag-coupon-feedback"
              :placeholder="t('Enter code', 'اكتب الكود')"
              @input="offerError = ''"
            />
            <button
              class="button button-outline"
              type="submit"
              :disabled="offerBusy || !codeInput.trim()"
            >
              {{ offerBusy ? t('Checking…', 'جارٍ التحقق…') : t('Apply', 'تطبيق') }}
            </button>
          </div>
          <p id="bag-coupon-feedback" v-if="offerError" class="field-error" role="alert">
            {{ offerError }}
          </p>
          <p v-else-if="offerBusy" id="bag-coupon-feedback" class="muted" role="status">
            {{ t('Checking your price…', 'جارٍ التحقق من السعر…') }}
          </p>
          <button v-if="appliedCode" type="button" class="remove-link" @click="removeCode">
            {{ t('Remove code', 'إزالة الكود') }}
          </button>
        </form>
        <p v-if="!user && guestWelcomePrice !== null" class="bag-login-offer">
          <b>WELCOME10</b> · {{ t('First signed-in order:', 'أول طلب بعد تسجيل حساب:') }}
          <strong>{{ money(guestWelcomePrice) }}</strong>
          {{
            t(
              'before delivery, if eligible. Your exact total is confirmed at checkout.',
              'قبل الشحن، إذا كنت مؤهلاً. الإجمالي النهائي يتأكد عند إتمام الطلب.',
            )
          }}
          <NuxtLink to="/account/register?returnTo=/cart">{{
            t('Create account', 'اعمل حساب')
          }}</NuxtLink>
        </p>
        <div class="bag-shipping-estimate">
          <label for="bag-governorate">{{ t('Delivery to', 'التوصيل إلى') }}</label>
          <select id="bag-governorate" v-model="governorate">
            <option value="">{{ t('Choose your governorate', 'اختار المحافظة') }}</option>
            <option
              v-for="zone in shippingOptions"
              :key="zone.governorate"
              :value="zone.governorate"
            >
              {{ governorateLabel(zone.governorate, locale) }}
            </option>
          </select>
          <NuxtLink to="/shipping">{{
            t('See all delivery rates', 'شوف أسعار الشحن لكل المحافظات')
          }}</NuxtLink>
        </div>
        <div class="summary-row muted">
          <span>{{ t('Delivery', 'التوصيل') }}</span>
          <span v-if="selectedShipping && (quote?.freeShipping ?? shippingData?.freeShipping)">
            <s v-if="selectedShipping.standardRate">{{ money(selectedShipping.standardRate) }}</s>
            <strong>{{ t('FREE', 'مجاني') }}</strong>
          </span>
          <span v-else-if="selectedShipping">{{ money(quote?.shipping ?? selectedShipping.rate) }}</span>
          <span v-else>{{ t('Choose governorate', 'اختار المحافظة') }}</span>
        </div>
        <div v-if="quote?.discount" class="summary-row bag-discount-row">
          <span>{{ t('Discount', 'الخصم') }} · {{ quote.couponCode }}</span>
          <strong>− {{ money(quote.discount) }}</strong>
        </div>
        <div class="summary-row summary-total" aria-live="polite">
          <span>{{
            selectedShipping
              ? t('Estimated total', 'الإجمالي المتوقع')
              : t('Before delivery', 'قبل التوصيل')
          }}</span>
          <strong>{{
            offerBusy
              ? t('Checking…', 'جارٍ الحساب…')
              : money(
                  selectedShipping
                    ? (quote?.total ?? discountedSubtotal + selectedShipping.rate)
                    : discountedSubtotal,
                )
          }}</strong>
        </div>
        <NuxtLink to="/checkout" class="button button-dark"
          >{{ t('Continue to checkout', 'متابعة لإتمام الطلب') }}<KhtIcon name="arrow" /></NuxtLink
        ><NuxtLink to="/shop" class="button button-outline">{{
          t('Continue exploring', 'كمّل تسوق')
        }}</NuxtLink>
        <p class="muted small-copy">
          {{
            t(
              'Cash on delivery only. Delivery is calculated before you place the order.',
              'الدفع عند الاستلام فقط. تكلفة الشحن بتتحسب قبل تسجيل الطلب.',
            )
          }}
        </p>
      </aside>
    </div>
    <div v-else class="empty-state">
      <span class="empty-line" />
      <h2>{{ t('A clean start.', 'بداية جديدة.') }}</h2>
      <p>{{ t('Your next essential is waiting.', 'قطعتك الجاية في انتظارك.') }}</p>
      <NuxtLink to="/shop" class="button button-dark"
        >{{ t('Explore the collection', 'اكتشف المجموعة') }}<KhtIcon name="arrow"
      /></NuxtLink>
    </div>
  </main>
</template>
