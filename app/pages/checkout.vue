<script setup lang="ts">
import type { DemoOrder } from '../../shared/types'
import type { OrderQuote } from '../../shared/discount'
import type { ShippingZone } from '../../shared/shipping'
import type { CustomerAddress } from '../../shared/account'
const { t, money, localized } = useLanguage()
const { lines, count, total, clear, flush, saved, resetLocal, restore } = useBag()
const { user } = useCustomer()
const { data: checkoutOptions } = await useFetch('/api/checkout/options')
const demo = ref(!checkoutOptions.value?.durable)
const requestId = useState('checkout-request-id', () => crypto.randomUUID())
const addresses = ref<CustomerAddress[]>([])
const addressId = ref('')
watch(addressId, (id) => {
  const address = addresses.value.find((item) => item.id === id)
  if (address)
    Object.assign(form.value, {
      name: address.name,
      phone: address.phone,
      address: address.address,
      city: address.governorate,
      district: address.city,
    })
})
onMounted(async () => {
  if (user.value) {
    form.value.name ||= user.value.name
    form.value.email ||= user.value.email
    form.value.phone ||= user.value.phone
    try {
      addresses.value = (await $fetch<{ items: CustomerAddress[] }>('/api/account/addresses')).items
      if (!form.value.address)
        addressId.value = addresses.value.find((item) => item.isDefault)?.id || ''
    } catch {
      /* The customer can still enter delivery details. */
    }
  }
})
const form = useState('checkout-draft', () => ({
  name: '',
  email: '',
  phone: '',
  city: 'Cairo',
  district: '',
  address: '',
}))
const phoneInvalid = ref(false)
const acknowledged = ref(false)
const busy = ref(false)
const error = ref('')
const couponCode = ref('')
const couponBusy = ref(false)
const couponError = ref('')
const couponQuote = ref<OrderQuote | null>(null)
const {
  data: shippingData,
  error: shippingError,
  status: shippingStatus,
} = await useFetch<{ items: ShippingZone[] }>('/api/shipping/options')
const shippingOptions = computed(() => shippingData.value?.items || [])
const selectedShipping = computed(() =>
  shippingOptions.value.find((option) => option.governorate === form.value.city),
)
const shipping = computed(() => selectedShipping.value?.rate || 0)

watch(
  shippingOptions,
  (options) => {
    if (options.length && !options.some((option) => option.governorate === form.value.city)) {
      form.value.city = options[0]!.governorate
    }
  },
  { immediate: true },
)

async function applyCoupon() {
  if (!couponCode.value.trim() || couponBusy.value) return
  couponBusy.value = true
  couponError.value = ''
  try {
    if (!demo.value) {
      await flush()
      const order = await $fetch<{ id: string; number: string }>('/api/checkout/order', {
        method: 'POST',
        body: {
          ...form.value,
          city: form.value.district || form.value.city,
          shippingGovernorate: form.value.city,
          requestId: requestId.value,
          confirmed: acknowledged.value,
          paymentMethod: 'cod',
          cartId: saved.value?.id,
          cartVersion: saved.value?.version,
          expectedTotal: couponQuote.value?.total ?? total.value + shipping.value,
          items: lines.value.map(({ id, size, quantity }) => ({ id, size, quantity })),
          couponCode: couponQuote.value?.couponCode,
        },
      })
      resetLocal()
      requestId.value = crypto.randomUUID()
      form.value = { name: '', email: '', phone: '', city: 'Cairo', district: '', address: '' }
      if (user.value) await restore(false).catch(() => undefined)
      await navigateTo(user.value ? `/account/orders/${order.id}` : `/orders/${order.id}`)
      return
    }
    couponQuote.value = await $fetch<OrderQuote>('/api/discounts/quote', {
      method: 'POST',
      body: {
        code: couponCode.value,
        shippingGovernorate: form.value.city,
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
function sampleDetails() {
  phoneInvalid.value = false
  Object.assign(form.value, {
    name: 'KHT Preview',
    email: 'preview@example.com',
    phone: '01000000000',
    address: 'Studio 001 — sample address',
  })
}
async function submit() {
  if (busy.value || !acknowledged.value) return
  busy.value = true
  error.value = ''
  try {
    const order = await $fetch<DemoOrder>('/api/checkout', {
      method: 'POST',
      body: {
        items: lines.value.map(({ id, size, quantity }) => ({ id, size, quantity })),
        demoAcknowledged: acknowledged.value,
        couponCode: couponQuote.value?.couponCode,
        shippingGovernorate: form.value.city,
      },
    })
    sessionStorage.setItem('kht-demo-order', JSON.stringify(order))
    clear()
    form.value = { name: '', email: '', phone: '', city: 'Cairo', district: '', address: '' }
    await navigateTo(`/order-confirmation/${order.reference}`)
  } catch (e: unknown) {
    const detail = e as { data?: { statusMessage?: string } }
    error.value = t(
      detail.data?.statusMessage ||
        'We could not complete the preview. Your bag is saved. Please try again.',
      'تعذر إكمال التجربة. سلتك محفوظة؛ راجع الكميات وحاول تاني.',
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
      ><div v-if="demo" class="demo-banner">
        <strong>{{ t('Explore the checkout.', 'جرّب إتمام الطلب.') }}</strong>
        <p>
          {{
            t(
              'Demo only. No payment or delivery. Use sample details; contact information stays in memory until you finish or reload.',
              'تجربة فقط، بدون دفع أو توصيل. استخدم بيانات المثال؛ بيانات التواصل تبقى في الذاكرة حتى الإتمام أو إعادة تحميل الموقع.',
            )
          }}
        </p>
        <button class="remove-link" @click="sampleDetails">
          {{ t('Use sample details', 'استخدم بيانات المثال') }}
        </button>
      </div>
      <div v-else class="demo-banner">
        <strong>{{ t('Cash on delivery', 'الدفع عند الاستلام') }}</strong>
        <p>
          {{
            t(
              'Confirm your delivery details to place your order. Payment is collected on delivery.',
              'أكد بيانات التوصيل لتسجيل طلبك. يتم الدفع عند الاستلام.',
            )
          }}
        </p>
        <NuxtLink v-if="!user" to="/account/login?returnTo=/checkout" class="remove-link">{{
          t('Sign in to save your bag and track orders', 'سجل الدخول لحفظ السلة ومتابعة الطلبات')
        }}</NuxtLink>
      </div>
      <label v-if="checkoutOptions?.durable" class="checkbox-label"
        ><input v-model="demo" type="checkbox" @change="acknowledged = false" /><span>{{
          t('Try a demo without placing an order', 'تجربة بدون تسجيل طلب فعلي')
        }}</span></label
      >
      <div class="commerce-grid">
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
                >{{ t('Email', 'البريد الإلكتروني')
                }}<input
                  v-model="form.email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  required
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
                  t(
                    'Enter 7–15 digits, with an optional country code.',
                    'اكتب من ٧ إلى ١٥ رقم، مع كود الدولة لو محتاج.',
                  )
                }}</span></label
              >
            </div>
          </fieldset>
          <fieldset>
            <legend><span>02</span>{{ t('Delivery', 'التوصيل') }}</legend>
            <label v-if="addresses.length"
              >{{ t('Saved address', 'عنوان محفوظ')
              }}<select v-model="addressId">
                <option value="">{{ t('Enter an address', 'إدخال عنوان') }}</option>
                <option v-for="item in addresses" :key="item.id" :value="item.id">
                  {{ item.label }} — {{ item.address }}
                </option>
              </select></label
            >
            <div class="form-grid">
              <label class="full-field"
                >{{ t('Governorate', 'المحافظة')
                }}<select
                  v-model="form.city"
                  name="city"
                  autocomplete="address-level2"
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
                >{{ t('City / district', 'المدينة / المنطقة')
                }}<input
                  v-model="form.district"
                  autocomplete="address-level2"
                  maxlength="100"
                  :required="!demo" /></label
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
                <strong>{{
                  demo
                    ? t('Standard delivery — sample', 'توصيل عادي — مثال')
                    : t('Standard delivery', 'توصيل عادي')
                }}</strong
                ><span>{{
                  demo
                    ? t(
                        'Illustrative rate, not a delivery promise.',
                        'تكلفة توضيحية وليست وعد توصيل.',
                      )
                    : t('Delivery charge for your governorate.', 'تكلفة التوصيل لمحافظتك.')
                }}</span>
              </div>
              <strong>{{ money(shipping) }}</strong>
            </div>
          </fieldset>
          <fieldset>
            <legend><span>03</span>{{ t('Review & payment', 'المراجعة والدفع') }}</legend>
            <p class="muted">
              {{
                demo
                  ? t(
                      'Live payment methods will appear here once KHT launches. This preview does not request card details.',
                      'طرق الدفع الفعلية هتظهر عند إطلاق KHT. التجربة لا تطلب بيانات بطاقة.',
                    )
                  : t(
                      'Pay the total below in cash when your order arrives.',
                      'ادفع الإجمالي الموضح نقدًا عند وصول طلبك.',
                    )
              }}
            </p>
            <label class="checkbox-label"
              ><input v-model="acknowledged" type="checkbox" required /><span>{{
                demo
                  ? t(
                      'I understand this is a demo and no real order will be placed.',
                      'فاهم إن دي تجربة ومش هيتم تسجيل طلب حقيقي.',
                    )
                  : t(
                      'I confirm my items, delivery details and total. Place my cash-on-delivery order.',
                      'أؤكد المنتجات وبيانات التوصيل والإجمالي وأسجل طلبي بالدفع عند الاستلام.',
                    )
              }}</span></label
            >
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
              <span>{{
                demo
                  ? t('Demo total · delivery included', 'الإجمالي التجريبي شامل التوصيل')
                  : t('Total · delivery included', 'الإجمالي شامل التوصيل')
              }}</span>
              <strong>{{ money(couponQuote?.total ?? total + shipping) }}</strong>
            </div>
            <button
              class="button button-dark"
              :disabled="busy || !acknowledged || !selectedShipping"
            >
              {{
                busy
                  ? t('Submitting…', 'جارٍ الإرسال…')
                  : demo
                    ? t('Preview order', 'معاينة الطلب')
                    : t('Place order · pay on delivery', 'تأكيد الطلب · الدفع عند الاستلام')
              }}<KhtIcon name="arrow" />
            </button>
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
            <span>{{ demo ? t('Sample delivery', 'توصيل توضيحي') : t('Delivery', 'التوصيل') }}</span
            ><span>{{ money(shipping) }}</span>
          </div>
          <div v-if="couponQuote?.discount" class="summary-row">
            <span>{{ t('Discount', 'الخصم') }} · {{ couponQuote.couponCode }}</span
            ><span>− {{ money(couponQuote.discount) }}</span>
          </div>
          <div class="summary-row summary-total">
            <strong>{{
              demo ? t('Demo total', 'الإجمالي التجريبي') : t('Total', 'الإجمالي')
            }}</strong
            ><strong>{{ money(couponQuote?.total ?? total + shipping) }}</strong>
          </div>
          <p v-if="demo" class="small-copy muted">
            {{
              t(
                'All displayed amounts are sample amounts. No additional fees in this demo.',
                'كل المبالغ المعروضة تجريبية. لا توجد رسوم إضافية في هذه التجربة.',
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
