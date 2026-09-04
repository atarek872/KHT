<script setup lang="ts">
import type { DemoOrder } from '../../shared/types'
const { t, money, localized } = useLanguage()
const { lines, count, total, clear } = useBag()
const form = useState('checkout-draft', () => ({
  name: '',
  email: '',
  phone: '',
  city: 'Cairo',
  address: '',
}))
const phoneInvalid = ref(false)
const acknowledged = ref(false)
const busy = ref(false)
const error = ref('')
const shipping = 60
function sampleDetails() {
  phoneInvalid.value = false
  Object.assign(form.value, {
    name: 'KHT Preview',
    email: 'preview@example.com',
    phone: '01000000000',
    city: 'Cairo',
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
      },
    })
    sessionStorage.setItem('kht-demo-order', JSON.stringify(order))
    clear()
    form.value = { name: '', email: '', phone: '', city: 'Cairo', address: '' }
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
      ><div class="demo-banner">
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
            <div class="form-grid">
              <label class="full-field"
                >{{ t('City', 'المدينة')
                }}<select v-model="form.city" name="city" autocomplete="address-level2">
                  <option value="Cairo">{{ t('Cairo', 'القاهرة') }}</option>
                  <option value="Giza">{{ t('Giza', 'الجيزة') }}</option>
                  <option value="Alexandria">{{ t('Alexandria', 'الإسكندرية') }}</option>
                </select></label
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
            <div class="delivery-option">
              <span class="selected-indicator" />
              <div>
                <strong>{{ t('Standard delivery — sample', 'توصيل عادي — مثال') }}</strong
                ><span>{{
                  t('Illustrative rate, not a delivery promise.', 'تكلفة توضيحية وليست وعد توصيل.')
                }}</span>
              </div>
              <strong>{{ money(shipping) }}</strong>
            </div>
          </fieldset>
          <fieldset>
            <legend><span>03</span>{{ t('Review & payment', 'المراجعة والدفع') }}</legend>
            <p class="muted">
              {{
                t(
                  'Live payment methods will appear here once KHT launches. This preview does not request card details.',
                  'طرق الدفع الفعلية هتظهر عند إطلاق KHT. التجربة لا تطلب بيانات بطاقة.',
                )
              }}
            </p>
            <label class="checkbox-label"
              ><input v-model="acknowledged" type="checkbox" required /><span>{{
                t(
                  'I understand this is a demo and no real order will be placed.',
                  'فاهم إن دي تجربة ومش هيتم تسجيل طلب حقيقي.',
                )
              }}</span></label
            >
            <p v-if="error" class="form-error" role="alert">{{ error }}</p>
            <div class="checkout-final-total" aria-live="polite">
              <span>{{
                t('Demo total · delivery included', 'الإجمالي التجريبي شامل التوصيل')
              }}</span>
              <strong>{{ money(total + shipping) }}</strong>
            </div>
            <button class="button button-dark" :disabled="busy || !acknowledged">
              {{
                busy
                  ? t('Preparing preview…', 'جارٍ تجهيز المعاينة…')
                  : t('Preview order', 'معاينة الطلب')
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
            <span>{{ t('Sample delivery', 'توصيل توضيحي') }}</span
            ><span>{{ money(shipping) }}</span>
          </div>
          <div class="summary-row summary-total">
            <strong>{{ t('Demo total', 'الإجمالي التجريبي') }}</strong
            ><strong>{{ money(total + shipping) }}</strong>
          </div>
          <p class="small-copy muted">
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
