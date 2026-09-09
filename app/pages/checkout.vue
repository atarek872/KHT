<script setup lang="ts">
import type { StorefrontOrderConfirmation } from '../../shared/storefrontOrder'
import type { OrderQuote } from '../../shared/discount'
import type { ShippingZone } from '../../shared/shipping'
import type { CustomerAddress } from '../../shared/account'
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
const form = useState('checkout-draft', () => ({
  name: '',
  email: '',
  phone: '',
  governorate: 'Cairo',
  city: '',
  address: '',
  notes: '',
}))
const phoneInvalid = ref(false)
const busy = ref(false)
const requestId = ref(crypto.randomUUID())
const error = ref('')
const couponCode = ref('')
const couponBusy = ref(false)
const couponError = ref('')
const couponQuote = ref<OrderQuote | null>(null)
let contactSnapshotTimer: ReturnType<typeof setTimeout> | undefined
watch(addressId, (id) => {
  const address = addresses.value.find((item) => item.id === id)
  if (!address) return
  Object.assign(form.value, {
    name: address.name,
    phone: address.phone,
    address: address.address,
    governorate: address.governorate,
    city: address.city,
  })
})
onMounted(async () => {
  if (count.value) trackBeginCheckout(lines.value, total.value)
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
const shippingOptions = computed(() => shippingData.value?.items || [])
const selectedShipping = computed(() =>
  shippingOptions.value.find((option) => option.governorate === form.value.governorate),
)
const shipping = computed(() => selectedShipping.value?.rate || 0)

watch(
  shippingOptions,
  (options) => {
    if (
      options.length &&
      !options.some((option) => option.governorate === form.value.governorate)
    ) {
      form.value.governorate = options[0]!.governorate
    }
  },
  { immediate: true },
)

async function applyCoupon() {
  if (!couponCode.value.trim() || couponBusy.value) return
  couponBusy.value = true
  couponError.value = ''
  try {
    couponQuote.value = await $fetch<OrderQuote>('/api/discounts/quote', {
      method: 'POST',
      body: {
        code: couponCode.value,
        shippingGovernorate: form.value.governorate,
        items: lines.value.map(({ id, size, quantity }) => ({ id, size, quantity })),
      },
    })
    couponCode.value = couponQuote.value.couponCode || couponCode.value.toUpperCase()
  } catch (cause: unknown) {
    const failure = cause as { data?: { statusMessage?: string } }
    couponQuote.value = null
    couponError.value =
      failure.data?.statusMessage || t('Coupon could not be applied.', 'تعذر تطبيق الكوبون.')
  } finally {
    couponBusy.value = false
  }
}

watch(
  () => lines.value.map((line) => `${line.id}:${line.size}:${line.quantity}`).join('|'),
  () => {
    couponQuote.value = null
    couponError.value = ''
  },
)
watch(couponCode, (value) => {
  if (couponQuote.value && value.trim().toUpperCase() !== couponQuote.value.couponCode) {
    couponQuote.value = null
  }
})
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
async function submit() {
  if (busy.value || !selectedShipping.value) return
  busy.value = true
  error.value = ''
  try {
    if (user.value) {
      await flush()
      const accountOrder = await $fetch<{ id: string; number: string }>('/api/checkout/order', {
        method: 'POST',
        body: {
          ...form.value,
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
          phone: form.value.phone,
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
    form.value = {
      name: '',
      email: '',
      phone: '',
      governorate: 'Cairo',
      city: '',
      address: '',
      notes: '',
    }
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
      ><div class="commerce-grid">
        <form id="checkout-form" class="checkout-form" @submit.prevent="submit">
          <fieldset>
            <legend><span>01</span>{{ t('Your details', 'بياناتك') }}</legend>
            <div class="form-grid">
              <label class="full-field"
                >{{ t('Full name', 'الاسم بالكامل')
                }}<input
                  v-model="form.name"
                  name="name"
                  autocomplete="name"
                  required
                  maxlength="100" /></label
              ><label
                >{{ t('Email (optional)', 'البريد الإلكتروني (اختياري)')
                }}<input
                  v-model="form.email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  maxlength="160" /></label
              ><label
                >{{ t('Phone', 'الهاتف')
                }}<input
                  v-model="form.phone"
                  name="phone"
                  type="tel"
                  inputmode="tel"
                  autocomplete="tel"
                  required
                  pattern="(?=(?:[^0-9٠-٩۰-۹]*[0-9٠-٩۰-۹]){7,15}[^0-9٠-٩۰-۹]*$)[+0-9٠-٩۰-۹ \(\)\-]{7,20}"
                  maxlength="20"
                  :aria-invalid="phoneInvalid || undefined"
                  :aria-describedby="phoneInvalid ? 'phone-error' : undefined"
                  @invalid="phoneInvalid = true"
                  @input="phoneInvalid = false"
                  @blur="
                    phoneInvalid =
                      !!form.phone && !($event.target as HTMLInputElement).validity.valid
                  "
                /><span v-if="phoneInvalid" id="phone-error" class="field-error" role="alert">{{
                  t('Enter a valid Egyptian mobile number.', 'اكتب رقم موبايل مصري صحيح.')
                }}</span></label
              >
            </div>
          </fieldset>
          <fieldset>
            <legend><span>02</span>{{ t('Delivery', 'التوصيل') }}</legend>
            <label v-if="addresses.length" class="full-field"
              >{{ t('Saved address', 'عنوان محفوظ') }}
              <select v-model="addressId">
                <option value="">{{ t('Enter another address', 'إدخال عنوان آخر') }}</option>
                <option v-for="item in addresses" :key="item.id" :value="item.id">
                  {{ item.label }} — {{ item.address }}
                </option>
              </select></label
            >
            <div class="form-grid">
              <label class="full-field"
                >{{ t('Governorate', 'المحافظة')
                }}<select
                  v-model="form.governorate"
                  name="governorate"
                  autocomplete="address-level1"
                  required
                  :disabled="shippingStatus === 'pending' || !shippingOptions.length"
                >
                  <option
                    v-for="option in shippingOptions"
                    :key="option.governorate"
                    :value="option.governorate"
                  >
                    {{ option.governorate }}
                  </option>
                </select></label
              ><label class="full-field"
                >{{ t('City or area', 'المدينة أو المنطقة')
                }}<input
                  v-model="form.city"
                  name="city"
                  autocomplete="address-level2"
                  required
                  maxlength="100" /></label
              ><label class="full-field"
                >{{ t('Street address', 'العنوان')
                }}<input
                  v-model="form.address"
                  name="address"
                  autocomplete="street-address"
                  required
                  maxlength="250"
              /></label>
            </div>
            <p v-if="shippingError" class="form-error" role="alert">
              {{ t('Delivery options could not be loaded.', 'تعذر تحميل خيارات التوصيل.') }}
            </p>
            <div class="delivery-option">
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
          <fieldset>
            <legend><span>03</span>{{ t('Review & payment', 'المراجعة والدفع') }}</legend>
            <div class="delivery-option">
              <input
                type="radio"
                name="payment-method"
                value="cod"
                checked
                aria-label="Cash on delivery"
              />
              <div>
                <strong>{{ t('Cash on delivery', 'الدفع عند الاستلام') }}</strong
                ><span>{{
                  t('Pay the courier when your order arrives.', 'ادفع لمندوب الشحن وقت وصول الطلب.')
                }}</span>
              </div>
            </div>
            <div class="form-grid">
              <label class="full-field"
                >{{ t('Order notes (optional)', 'ملاحظات الطلب (اختياري)')
                }}<textarea v-model="form.notes" name="notes" maxlength="500" rows="3" />
              </label>
            </div>
            <p v-if="error" class="form-error" role="alert">{{ error }}</p>
            <div class="checkout-coupon">
              <label for="checkout-coupon">{{ t('Coupon code', 'كود الخصم') }}</label>
              <div>
                <input
                  id="checkout-coupon"
                  v-model.trim="couponCode"
                  autocomplete="off"
                  placeholder="WELCOME10"
                />
                <button
                  type="button"
                  class="button button-outline"
                  :disabled="couponBusy || !couponCode"
                  @click="applyCoupon"
                >
                  {{ couponBusy ? t('Applying…', 'جارٍ التطبيق…') : t('Apply', 'تطبيق') }}
                </button>
              </div>
              <p v-if="couponError" class="field-error" role="alert">{{ couponError }}</p>
              <p v-else-if="couponQuote" role="status">
                {{ t('Coupon applied.', 'تم تطبيق الكوبون.') }}
              </p>
            </div>
            <div class="checkout-final-total" aria-live="polite">
              <span>{{ t('Order total · delivery included', 'إجمالي الطلب شامل التوصيل') }}</span>
              <strong>{{ money(couponQuote?.total ?? total + shipping) }}</strong>
            </div>
            <button class="button button-dark" :disabled="busy || !selectedShipping">
              {{
                busy
                  ? t('Placing order…', 'جارٍ تسجيل الطلب…')
                  : t('Place COD order', 'سجّل طلب الدفع عند الاستلام')
              }}<KhtIcon name="arrow" />
            </button>
            <p class="small-copy muted">
              {{ t('By placing the order, you agree to the', 'بتسجيل الطلب أنت موافق على') }}
              <NuxtLink to="/terms">{{ t('terms', 'الشروط') }}</NuxtLink>
              {{ t('and acknowledge the', 'ومطلع على') }}
              <NuxtLink to="/shipping">{{
                t('shipping and exchange policy', 'سياسة الشحن والاستبدال')
              }}</NuxtLink
              >.
            </p>
          </fieldset>
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
            <span>{{ money(line.quantity * line.product.price) }}</span>
          </div>
          <div class="summary-row">
            <span>{{ t('Subtotal', 'المجموع الفرعي') }}</span
            ><span>{{ money(total) }}</span>
          </div>
          <div class="summary-row">
            <span>{{ t('Delivery', 'التوصيل') }}</span
            ><span>{{ money(shipping) }}</span>
          </div>
          <div v-if="couponQuote?.discount" class="summary-row">
            <span>{{ t('Discount', 'الخصم') }} · {{ couponQuote.couponCode }}</span
            ><span>− {{ money(couponQuote.discount) }}</span>
          </div>
          <div class="summary-row summary-total">
            <strong>{{ t('Order total', 'إجمالي الطلب') }}</strong
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
