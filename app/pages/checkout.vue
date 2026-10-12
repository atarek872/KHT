<script setup lang="ts">
import type { StorefrontOrderConfirmation } from '../../shared/storefrontOrder'
import type { OrderQuote } from '../../shared/discount'
import type { ShippingZone } from '../../shared/shipping'
import type { CustomerAddress } from '../../shared/account'
import type { PublicWelcomeCampaign } from '../../shared/welcomeCampaign'
import { sizePrice } from '#shared/productPricing'
import {
  invalidCheckoutFields,
  normalizeCheckoutPhone,
  type CheckoutField,
  type CheckoutStep,
} from '#shared/checkoutSteps'
const { t, money, localized } = useLanguage()
const {
  lines,
  count,
  total,
  cartId,
  completeCheckout,
  snapshotContact,
  flush,
  saved,
  resetLocal,
  restore,
} = useBag()
const { user } = useCustomer()
const { trackBeginCheckout, trackPurchase } = useStoreAnalytics()
const addresses = ref<CustomerAddress[]>([])
const addressId = ref('')
const addressFieldsOpen = ref(true)
const step = ref<CheckoutStep>(1)
const fieldErrors = ref<CheckoutField[]>([])
const newCheckoutDraft = () => ({
  name: '',
  email: '',
  phone: '',
  governorate: '',
  city: '',
  address: '',
  notes: '',
})
const form = useState('checkout-draft', newCheckoutDraft)
const busy = ref(false)
const requestId = ref(crypto.randomUUID())
const error = ref('')
const couponCode = ref('')
const couponBusy = ref(false)
const couponError = ref('')
const couponQuote = ref<OrderQuote | null>(null)
const appliedCouponCode = ref('')
const welcomeBusy = ref(false)
let quoteRequestId = 0
let requestedCouponCode = ''
let contactSnapshotTimer: ReturnType<typeof setTimeout> | undefined
watch(addressId, (id, previousId) => {
  const address = addresses.value.find((item) => item.id === id)
  if (!address) {
    addressFieldsOpen.value = true
    if (previousId) {
      form.value.governorate = ''
      form.value.city = ''
      form.value.address = ''
    }
    return
  }
  addressFieldsOpen.value = false
  Object.assign(form.value, {
    address: address.address,
    governorate: address.governorate,
    city: address.city,
  })
  form.value.name ||= address.name
  form.value.phone ||= address.phone
})
onMounted(async () => {
  if (count.value) trackBeginCheckout(lines.value, total.value)
  await refreshAutomaticOffer()
  if (!user.value) return
  form.value.name ||= user.value.name
  form.value.email ||= user.value.email
  form.value.phone ||= user.value.phone
  try {
    addresses.value = (await $fetch<{ items: CustomerAddress[] }>('/api/account/addresses')).items
    if (!form.value.address)
      addressId.value = addresses.value.find((item) => item.isDefault)?.id || ''
  } catch {
    /* Manual delivery details remain available. */
  }
})
const {
  data: shippingData,
  error: shippingError,
  status: shippingStatus,
} = await useFetch<{ items: ShippingZone[] }>('/api/shipping/options')
const { data: welcomeCampaignData } = await useFetch<{
  campaign: PublicWelcomeCampaign | null
}>('/api/storefront/welcome-campaign', { key: 'welcome-campaign' })
const welcomeCampaign = computed(() => welcomeCampaignData.value?.campaign || null)
const shippingOptions = computed(() => shippingData.value?.items || [])
const selectedShipping = computed(() =>
  shippingOptions.value.find((option) => option.governorate === form.value.governorate),
)
const shipping = computed(() => selectedShipping.value?.rate || 0)

watch(
  shippingOptions,
  (options) => {
    if (
      form.value.governorate &&
      !options.some((option) => option.governorate === form.value.governorate)
    ) {
      form.value.governorate = ''
    }
  },
  { immediate: true },
)

async function applyCoupon(code = couponCode.value) {
  if (!code.trim() || !count.value || !selectedShipping.value) return
  const requestId = ++quoteRequestId
  requestedCouponCode = code.trim().toUpperCase()
  couponBusy.value = true
  welcomeBusy.value = false
  couponError.value = ''
  try {
    const quote = await $fetch<OrderQuote>('/api/discounts/quote', {
      method: 'POST',
      body: {
        code,
        shippingGovernorate: form.value.governorate,
        items: lines.value.map(({ id, size, quantity }) => ({ id, size, quantity })),
      },
    })
    if (requestId !== quoteRequestId) return
    couponQuote.value = quote
    appliedCouponCode.value = quote.couponCode || code.toUpperCase()
    couponCode.value = appliedCouponCode.value
  } catch (cause: unknown) {
    if (requestId !== quoteRequestId) return
    const failure = cause as { data?: { statusMessage?: string } }
    couponQuote.value = null
    appliedCouponCode.value = ''
    couponError.value =
      failure.data?.statusMessage || t('Coupon could not be applied.', 'تعذر تطبيق الكوبون.')
    couponBusy.value = false
    void refreshAutomaticOffer()
  } finally {
    if (requestId === quoteRequestId) couponBusy.value = false
  }
}

async function refreshAutomaticOffer() {
  if (!count.value || !selectedShipping.value || appliedCouponCode.value) return
  if (!user.value && welcomeCampaign.value?.loginRequired) return
  const requestId = ++quoteRequestId
  welcomeBusy.value = true
  try {
    const quote = await $fetch<OrderQuote>('/api/discounts/quote', {
      method: 'POST',
      body: {
        shippingGovernorate: form.value.governorate,
        items: lines.value.map(({ id, size, quantity }) => ({ id, size, quantity })),
      },
    })
    if (requestId === quoteRequestId)
      couponQuote.value = quote.promotion === 'welcome' ? quote : null
  } catch {
    if (requestId === quoteRequestId) couponQuote.value = null
  } finally {
    if (requestId === quoteRequestId) welcomeBusy.value = false
  }
}

function campaignRedirect(path: string) {
  return path.replaceAll('{current}', encodeURIComponent('/checkout'))
}

function promotionRule(quote: OrderQuote) {
  if (quote.promotionType === 'percentage') return `${quote.promotionValue || 0}%`
  return money(quote.promotionValue || 0)
}

watch(
  () => lines.value.map((line) => `${line.id}:${line.size}:${line.quantity}`).join('|'),
  () => {
    quoteRequestId++
    couponBusy.value = false
    welcomeBusy.value = false
    couponQuote.value = null
    couponError.value = ''
    if (appliedCouponCode.value) void applyCoupon(appliedCouponCode.value)
    else void nextTick(refreshAutomaticOffer)
  },
)
watch(couponCode, (value) => {
  couponError.value = ''
  if (couponBusy.value && value.trim().toUpperCase() !== requestedCouponCode) {
    quoteRequestId++
    couponBusy.value = false
    welcomeBusy.value = false
    couponQuote.value = null
    if (!appliedCouponCode.value) void refreshAutomaticOffer()
  }
  if (appliedCouponCode.value && value.trim().toUpperCase() !== appliedCouponCode.value) {
    quoteRequestId++
    appliedCouponCode.value = ''
    couponBusy.value = false
    welcomeBusy.value = false
    couponQuote.value = null
    void refreshAutomaticOffer()
  }
})
watch(
  () => [user.value?.id, form.value.governorate],
  () => {
    quoteRequestId++
    couponBusy.value = false
    welcomeBusy.value = false
    couponQuote.value = null
    if (appliedCouponCode.value) void applyCoupon(appliedCouponCode.value)
    else void refreshAutomaticOffer()
  },
)
watch(
  () => [form.value.name, form.value.phone, form.value.email],
  () => {
    clearTimeout(contactSnapshotTimer)
    contactSnapshotTimer = setTimeout(() => {
      const digitCount = form.value.phone.match(/[0-9٠-٩۰-۹]/g)?.length || 0
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email.trim())
      if (!count.value || (digitCount < 11 && !validEmail)) return
      snapshotContact({
        name: form.value.name || undefined,
        phone: form.value.phone || undefined,
        email: form.value.email || undefined,
      })
    }, 600)
  },
)
onBeforeUnmount(() => clearTimeout(contactSnapshotTimer))
function clearFieldError(field: CheckoutField) {
  fieldErrors.value = fieldErrors.value.filter((item) => item !== field)
}

async function showStep(nextStep: CheckoutStep) {
  if (busy.value) return
  step.value = nextStep
  await nextTick()
  document.getElementById(`checkout-step-${nextStep}`)?.focus()
}

async function validateStep(targetStep: 1 | 2) {
  const invalid = invalidCheckoutFields(
    targetStep,
    form.value,
    shippingOptions.value.map((option) => option.governorate),
  )
  fieldErrors.value = invalid
  if (!invalid.length) return true
  if (targetStep === 2 && addressId.value) addressFieldsOpen.value = true
  await showStep(targetStep)
  await nextTick()
  document.querySelector<HTMLElement>(`[name="${invalid[0]}"]`)?.focus()
  return false
}

async function handleStepAction() {
  if (busy.value) return
  if (step.value === 1) {
    if (await validateStep(1)) await showStep(2)
    return
  }
  if (step.value === 2) {
    if (await validateStep(2)) await showStep(3)
    return
  }
  if (!(await validateStep(1)) || !(await validateStep(2))) return
  await submit()
}

async function submit() {
  if (busy.value || !selectedShipping.value) return
  const normalizedPhone = normalizeCheckoutPhone(form.value.phone)
  if (!normalizedPhone) {
    await validateStep(1)
    return
  }
  busy.value = true
  error.value = ''
  try {
    if (user.value) {
      await flush()
      const accountOrder = await $fetch<{ id: string; number: string }>('/api/checkout/order', {
        method: 'POST',
        body: {
          ...form.value,
          phone: normalizedPhone,
          shippingGovernorate: form.value.governorate,
          requestId: requestId.value,
          confirmed: true,
          paymentMethod: 'cod',
          cartId: saved.value?.id,
          cartVersion: saved.value?.version,
          expectedTotal: couponQuote.value?.total ?? total.value + shipping.value,
          items: lines.value.map(({ id, size, quantity }) => ({ id, size, quantity })),
          couponCode: couponQuote.value?.couponCode,
        },
      })
      trackPurchase({
        transactionId: accountOrder.number,
        value: couponQuote.value?.total ?? total.value + shipping.value,
        shipping: couponQuote.value?.shipping ?? shipping.value,
        discount: couponQuote.value?.discount ?? 0,
        coupon: couponQuote.value?.couponCode,
        items: lines.value,
      })
      resetLocal()
      form.value = newCheckoutDraft()
      requestId.value = crypto.randomUUID()
      if (user.value) await restore(false).catch(() => undefined)
      await navigateTo(`/account/orders/${accountOrder.id}`)
      return
    }
    const order = await $fetch<StorefrontOrderConfirmation>('/api/checkout', {
      method: 'POST',
      body: {
        requestId: requestId.value,
        cartId: cartId.value,
        customer: {
          name: form.value.name,
          email: form.value.email || undefined,
          phone: normalizedPhone,
          address: form.value.address,
          governorate: form.value.governorate,
          city: form.value.city,
        },
        items: lines.value.map(({ id, size, quantity }) => ({ id, size, quantity })),
        couponCode: couponQuote.value?.couponCode,
        shippingGovernorate: form.value.governorate,
        paymentMethod: 'cod',
        notes: form.value.notes || undefined,
      },
    })
    trackPurchase({
      transactionId: order.reference,
      value: order.total,
      shipping: order.shipping,
      discount: order.discount,
      coupon: order.discountCode,
      items: lines.value,
    })
    completeCheckout()
    requestId.value = crypto.randomUUID()
    form.value = newCheckoutDraft()
    await navigateTo(`/order-confirmation/${order.reference}`)
  } catch (e: unknown) {
    const detail = e as { data?: { statusMessage?: string } }
    error.value = t(
      detail.data?.statusMessage ||
        'We could not place your order. Your bag and details are saved. Review the message and try again.',
      'تعذر تسجيل طلبك. السلة والبيانات محفوظة؛ راجع الرسالة وحاول تاني.',
    )
  } finally {
    busy.value = false
  }
}
useSeoMeta({ title: () => t('Checkout — KHT', 'إتمام الطلب — KHT'), robots: 'noindex, nofollow' })
</script>
<template>
  <main id="main" class="commerce-page checkout-page light-surface">
    <NuxtLink to="/cart" class="back-link">{{ t('Back to your bag', 'ارجع للسلة') }}</NuxtLink>
    <div class="page-heading">
      <p class="eyebrow">KHT / {{ t('THE FINAL DETAILS', 'التفاصيل الأخيرة') }}</p>
      <h1>{{ t('MAKE IT YOURS.', 'كمّل إطلالتك.') }}</h1>
    </div>
    <template v-if="count"
      ><div class="commerce-grid" :class="`checkout-step-${step}`">
        <form
          id="checkout-form"
          class="checkout-form"
          novalidate
          @submit.prevent="handleStepAction"
        >
          <nav class="checkout-progress" :aria-label="t('Checkout progress', 'مراحل إتمام الطلب')">
            <ol>
              <li>
                <button
                  type="button"
                  :aria-current="step === 1 ? 'step' : undefined"
                  :disabled="busy"
                  @click="showStep(1)"
                >
                  <span>01</span>{{ t('Contact', 'البيانات') }}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  :aria-current="step === 2 ? 'step' : undefined"
                  :disabled="step < 2 || busy"
                  @click="showStep(2)"
                >
                  <span>02</span>{{ t('Delivery', 'التوصيل') }}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  :aria-current="step === 3 ? 'step' : undefined"
                  :disabled="step < 3 || busy"
                  @click="showStep(3)"
                >
                  <span>03</span>{{ t('Review', 'المراجعة') }}
                </button>
              </li>
            </ol>
          </nav>

          <fieldset v-if="step === 1" id="checkout-step-1" tabindex="-1">
            <legend><span>01</span>{{ t('How can we reach you?', 'إزاي نتواصل معاك؟') }}</legend>
            <p v-if="!user" class="checkout-guest-note">
              {{ t('Checkout as a guest — no account needed.', 'كمّل كضيف — مش محتاج تعمل حساب.') }}
            </p>
            <aside
              v-if="!user && welcomeCampaign?.loginRequired"
              class="checkout-welcome-offer"
              aria-labelledby="checkout-welcome-title"
            >
              <div>
                <p class="eyebrow">{{ localized(welcomeCampaign.eyebrow) }}</p>
                <h2 id="checkout-welcome-title">{{ localized(welcomeCampaign.title) }}</h2>
                <p>{{ localized(welcomeCampaign.body) }}</p>
              </div>
              <div class="checkout-welcome-links">
                <NuxtLink :to="campaignRedirect(welcomeCampaign.primaryRedirect)">{{
                  localized(welcomeCampaign.primaryLabel)
                }}</NuxtLink>
                <NuxtLink :to="campaignRedirect(welcomeCampaign.secondaryRedirect)">{{
                  localized(welcomeCampaign.secondaryLabel)
                }}</NuxtLink>
              </div>
            </aside>
            <div class="form-grid">
              <label class="full-field"
                >{{ t('Full name', 'الاسم بالكامل') }}
                <input
                  v-model="form.name"
                  name="name"
                  autocomplete="name"
                  required
                  maxlength="100"
                  :aria-invalid="fieldErrors.includes('name') || undefined"
                  :aria-describedby="
                    fieldErrors.includes('name') ? 'checkout-name-error' : undefined
                  "
                  @input="clearFieldError('name')"
                />
                <span
                  v-if="fieldErrors.includes('name')"
                  id="checkout-name-error"
                  class="field-error"
                  role="alert"
                  >{{ t('Enter the name for this order.', 'اكتب الاسم المطلوب على الطلب.') }}</span
                >
              </label>
              <label class="full-field"
                >{{ t('Mobile number', 'رقم الموبايل') }}
                <input
                  v-model="form.phone"
                  name="phone"
                  type="tel"
                  inputmode="tel"
                  autocomplete="tel"
                  required
                  maxlength="20"
                  :aria-invalid="fieldErrors.includes('phone') || undefined"
                  :aria-describedby="
                    fieldErrors.includes('phone') ? 'checkout-phone-error' : 'checkout-phone-help'
                  "
                  @input="clearFieldError('phone')"
                />
                <span id="checkout-phone-help" class="checkout-field-help">{{
                  t(
                    'The courier will use this number to arrange delivery.',
                    'شركة الشحن هتتواصل معاك على الرقم ده لتنسيق التوصيل.',
                  )
                }}</span>
                <span
                  v-if="fieldErrors.includes('phone')"
                  id="checkout-phone-error"
                  class="field-error"
                  role="alert"
                  >{{ t('Enter a valid mobile number.', 'اكتب رقم موبايل صحيح.') }}</span
                >
              </label>
              <label class="full-field"
                >{{ t('Email (optional)', 'البريد الإلكتروني (اختياري)') }}
                <input
                  v-model="form.email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  maxlength="160"
                  :aria-invalid="fieldErrors.includes('email') || undefined"
                  :aria-describedby="
                    fieldErrors.includes('email') ? 'checkout-email-error' : undefined
                  "
                  @input="clearFieldError('email')"
                />
                <span
                  v-if="fieldErrors.includes('email')"
                  id="checkout-email-error"
                  class="field-error"
                  role="alert"
                  >{{
                    t(
                      'Enter a valid email or leave this blank.',
                      'اكتب بريدًا صحيحًا أو اترك الخانة فارغة.',
                    )
                  }}</span
                >
              </label>
            </div>
          </fieldset>

          <fieldset v-else-if="step === 2" id="checkout-step-2" tabindex="-1">
            <legend><span>02</span>{{ t('Where should we deliver?', 'هنوصل الطلب فين؟') }}</legend>
            <label v-if="addresses.length" class="checkout-saved-address-select"
              >{{ t('Saved address', 'عنوان محفوظ') }}
              <select v-model="addressId">
                <option value="">{{ t('Enter another address', 'إدخال عنوان آخر') }}</option>
                <option v-for="item in addresses" :key="item.id" :value="item.id">
                  {{ item.label }} — {{ item.address }}
                </option>
              </select>
            </label>
            <div v-if="addressId && !addressFieldsOpen" class="checkout-saved-address">
              <strong>{{ form.address }}</strong>
              <span>{{ form.city }} · {{ form.governorate }}</span>
              <button type="button" class="remove-link" @click="addressFieldsOpen = true">
                {{ t('Edit delivery address', 'عدّل عنوان التوصيل') }}
              </button>
            </div>
            <div v-else class="form-grid">
              <label class="full-field"
                >{{ t('Governorate', 'المحافظة') }}
                <select
                  v-model="form.governorate"
                  name="governorate"
                  autocomplete="address-level1"
                  required
                  :disabled="shippingStatus === 'pending' || !shippingOptions.length"
                  :aria-invalid="fieldErrors.includes('governorate') || undefined"
                  :aria-describedby="
                    fieldErrors.includes('governorate') ? 'checkout-governorate-error' : undefined
                  "
                  @change="clearFieldError('governorate')"
                >
                  <option value="" disabled>
                    {{ t('Select your governorate', 'اختار المحافظة') }}
                  </option>
                  <option
                    v-for="option in shippingOptions"
                    :key="option.governorate"
                    :value="option.governorate"
                  >
                    {{ option.governorate }}
                  </option>
                </select>
                <span
                  v-if="fieldErrors.includes('governorate')"
                  id="checkout-governorate-error"
                  class="field-error"
                  role="alert"
                  >{{
                    t('Choose a delivery area from the list.', 'اختار محافظة متاح لها التوصيل.')
                  }}</span
                >
              </label>
              <label class="full-field"
                >{{ t('City or area', 'المدينة أو المنطقة') }}
                <input
                  v-model="form.city"
                  name="city"
                  autocomplete="address-level2"
                  required
                  maxlength="100"
                  :aria-invalid="fieldErrors.includes('city') || undefined"
                  :aria-describedby="
                    fieldErrors.includes('city') ? 'checkout-city-error' : undefined
                  "
                  @input="clearFieldError('city')"
                />
                <span
                  v-if="fieldErrors.includes('city')"
                  id="checkout-city-error"
                  class="field-error"
                  role="alert"
                  >{{ t('Enter your city or area.', 'اكتب المدينة أو المنطقة.') }}</span
                >
              </label>
              <label class="full-field"
                >{{ t('Street address', 'العنوان بالتفصيل') }}
                <input
                  v-model="form.address"
                  name="address"
                  autocomplete="street-address"
                  required
                  maxlength="250"
                  :aria-invalid="fieldErrors.includes('address') || undefined"
                  :aria-describedby="
                    fieldErrors.includes('address') ? 'checkout-address-error' : undefined
                  "
                  @input="clearFieldError('address')"
                />
                <span
                  v-if="fieldErrors.includes('address')"
                  id="checkout-address-error"
                  class="field-error"
                  role="alert"
                  >{{
                    t('Enter a street address for delivery.', 'اكتب عنوان التوصيل بالتفصيل.')
                  }}</span
                >
              </label>
            </div>
            <p v-if="shippingError" class="form-error" role="alert">
              {{
                t(
                  'Delivery options could not be loaded. Refresh and try again.',
                  'تعذر تحميل مناطق التوصيل. حدّث الصفحة وحاول تاني.',
                )
              }}
            </p>
            <p
              v-else-if="!shippingOptions.length && shippingStatus !== 'pending'"
              class="form-error"
              role="alert"
            >
              {{ t('Delivery is not available right now.', 'التوصيل غير متاح حاليًا.') }}
            </p>
            <div v-if="selectedShipping" class="delivery-option" role="status">
              <span class="selected-indicator" />
              <div>
                <strong>{{ t('Standard delivery', 'توصيل عادي') }}</strong
                ><span>{{
                  t(
                    'The courier will contact you to coordinate delivery.',
                    'شركة الشحن هتتواصل معاك لتنسيق التوصيل.',
                  )
                }}</span>
              </div>
              <strong>{{ money(shipping) }}</strong>
            </div>
          </fieldset>

          <fieldset v-else id="checkout-step-3" tabindex="-1">
            <legend><span>03</span>{{ t('Review and confirm', 'راجع وأكد الطلب') }}</legend>
            <div class="checkout-review-block">
              <div>
                <strong>{{ t('Contact', 'بيانات التواصل') }}</strong
                ><button type="button" class="remove-link" @click="showStep(1)">
                  {{ t('Edit', 'تعديل') }}
                </button>
              </div>
              <p>
                {{ form.name }} · <bdi>{{ form.phone }}</bdi
                ><br v-if="form.email" /><span v-if="form.email">{{ form.email }}</span>
              </p>
            </div>
            <div class="checkout-review-block">
              <div>
                <strong>{{ t('Delivery', 'التوصيل') }}</strong
                ><button type="button" class="remove-link" @click="showStep(2)">
                  {{ t('Edit', 'تعديل') }}
                </button>
              </div>
              <p>{{ form.address }}<br />{{ form.city }} · {{ form.governorate }}</p>
            </div>
            <div class="checkout-review-block">
              <div>
                <strong>{{ t('Your items', 'القطع المطلوبة') }}</strong
                ><NuxtLink to="/cart" class="remove-link">{{
                  t('Edit bag', 'عدّل السلة')
                }}</NuxtLink>
              </div>
              <p
                v-for="line in lines"
                :key="`${line.id}:${line.size}`"
                class="checkout-review-item"
              >
                <span
                  >{{ localized(line.product.name) }} · {{ line.size }} × {{ line.quantity }}</span
                >
                <strong>{{ money(line.quantity * sizePrice(line.product, line.size)) }}</strong>
              </p>
              <p class="checkout-review-item">
                <span>{{ t('Delivery', 'التوصيل') }}</span
                ><strong>{{ money(shipping) }}</strong>
              </p>
              <p v-if="couponQuote?.discount" class="checkout-review-item">
                <span>{{ t('Discount', 'الخصم') }}</span
                ><strong>− {{ money(couponQuote.discount) }}</strong>
              </p>
            </div>
            <div class="delivery-option checkout-payment-note">
              <span class="selected-indicator" />
              <div>
                <strong>{{ t('Cash on delivery', 'الدفع عند الاستلام') }}</strong
                ><span>{{
                  t('Pay the courier when your order arrives.', 'ادفع لمندوب الشحن وقت وصول الطلب.')
                }}</span>
              </div>
            </div>
            <p v-if="welcomeBusy" class="checkout-welcome-status" role="status">
              {{ t('Checking your welcome gift…', 'جارٍ التحقق من هدية الترحيب…') }}
            </p>
            <p
              v-else-if="couponQuote?.promotion === 'welcome'"
              class="checkout-welcome-status applied"
              role="status"
            >
              {{ t('Your welcome gift is applied.', 'تم تطبيق هدية الترحيب.') }}
            </p>
            <details class="checkout-optional">
              <summary>{{ t('Have a discount code?', 'معاك كود خصم؟') }}</summary>
              <div class="checkout-coupon">
                <label for="checkout-coupon">{{ t('Coupon code', 'كود الخصم') }}</label>
                <div>
                  <input
                    id="checkout-coupon"
                    v-model.trim="couponCode"
                    autocomplete="off"
                    placeholder="WELCOME10"
                  /><button
                    type="button"
                    class="button button-outline"
                    :disabled="couponBusy || !couponCode"
                    @click="applyCoupon()"
                  >
                    {{ couponBusy ? t('Applying…', 'جارٍ التطبيق…') : t('Apply', 'تطبيق') }}
                  </button>
                </div>
                <p v-if="couponError" class="field-error" role="alert">{{ couponError }}</p>
                <p v-else-if="couponQuote && couponQuote.promotion !== 'welcome'" role="status">
                  {{ t('Coupon applied.', 'تم تطبيق الكوبون.') }}
                </p>
              </div>
            </details>
            <details class="checkout-optional" :open="Boolean(form.notes)">
              <summary>
                {{ t('Add delivery notes (optional)', 'أضف ملاحظات للتوصيل (اختياري)') }}
              </summary>
              <label class="checkout-notes"
                >{{ t('Order notes', 'ملاحظات الطلب')
                }}<textarea v-model="form.notes" name="notes" maxlength="500" rows="3" />
              </label>
            </details>
            <p v-if="error" class="form-error" role="alert">{{ error }}</p>
            <p class="small-copy muted checkout-terms">
              {{ t('By placing the order, you agree to the', 'بتسجيل الطلب أنت موافق على') }}
              <NuxtLink to="/terms">{{ t('terms', 'الشروط') }}</NuxtLink>
              {{ t('and acknowledge the', 'ومطلع على') }}
              <NuxtLink to="/shipping">{{
                t('shipping and exchange policy', 'سياسة الشحن والاستبدال')
              }}</NuxtLink
              >.
            </p>
          </fieldset>

          <div class="checkout-actions">
            <button
              v-if="step > 1"
              type="button"
              class="checkout-back-button"
              :disabled="busy"
              @click="showStep((step - 1) as CheckoutStep)"
            >
              {{ t('Back', 'رجوع') }}
            </button>
            <div class="checkout-final-total" aria-live="polite">
              <span>{{
                selectedShipping
                  ? t('Total · delivery included', 'الإجمالي شامل التوصيل')
                  : t('Subtotal', 'المجموع الفرعي')
              }}</span
              ><strong>{{ money(couponQuote?.total ?? total + shipping) }}</strong>
            </div>
            <button class="button button-dark checkout-primary-action" :disabled="busy">
              {{
                busy
                  ? t('Placing order…', 'جارٍ تسجيل الطلب…')
                  : step === 1
                    ? t('Continue to delivery', 'متابعة للتوصيل')
                    : step === 2
                      ? t('Review order', 'مراجعة الطلب')
                      : t('Confirm COD order', 'أكد طلب الدفع عند الاستلام')
              }}<KhtIcon name="arrow" />
            </button>
          </div>
        </form>
        <aside class="order-summary checkout-summary">
          <h2>
            {{ t('Your selection', 'اختياراتك') }} <span>({{ count }})</span>
          </h2>
          <div v-for="line in lines" :key="line.id + line.size" class="checkout-line">
            <StoreImage
              :src="line.product.image"
              sizes="72px"
              :alt="localized(line.product.name)"
              width="72"
              height="96"
            />
            <div>
              <strong>{{ localized(line.product.name) }}</strong
              ><span>{{ line.size }} / {{ t('Qty', 'الكمية') }} {{ line.quantity }}</span>
            </div>
            <span>{{ money(line.quantity * sizePrice(line.product, line.size)) }}</span>
          </div>
          <div class="summary-row">
            <span>{{ t('Subtotal', 'المجموع الفرعي') }}</span
            ><span>{{ money(total) }}</span>
          </div>
          <div class="summary-row">
            <span>{{ t('Delivery', 'التوصيل') }}</span
            ><span>{{
              selectedShipping ? money(shipping) : t('Select area', 'اختار المحافظة')
            }}</span>
          </div>
          <div v-if="couponQuote?.discount" class="summary-row">
            <span>{{
              couponQuote.promotion === 'welcome'
                ? `${t('Welcome gift', 'هدية الترحيب')} · ${promotionRule(couponQuote)}`
                : `${t('Discount', 'الخصم')} · ${couponQuote.couponCode}`
            }}</span
            ><span>− {{ money(couponQuote.discount) }}</span>
          </div>
          <div class="summary-row summary-total">
            <strong>{{
              selectedShipping
                ? t('Order total', 'إجمالي الطلب')
                : t('Subtotal before delivery', 'المجموع قبل التوصيل')
            }}</strong
            ><strong>{{ money(couponQuote?.total ?? total + shipping) }}</strong>
          </div>
          <p class="small-copy muted">
            {{
              t(
                'No account is required. Prices and stock are confirmed when you place the order.',
                'مش محتاج تعمل حساب. السعر والمخزون بيتأكدوا وقت تسجيل الطلب.',
              )
            }}
          </p>
          <NuxtLink to="/cart" class="remove-link">{{ t('Edit your bag', 'عدّل السلة') }}</NuxtLink>
        </aside>
      </div></template
    >
    <div v-else class="empty-state">
      <h2>{{ t('Your bag is empty.', 'سلتك فاضية.') }}</h2>
      <NuxtLink to="/shop" class="button button-dark"
        >{{ t('Explore the collection', 'اكتشف المجموعة') }}<KhtIcon name="arrow"
      /></NuxtLink>
    </div>
  </main>
</template>
