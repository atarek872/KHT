<script setup lang="ts">
import type { AdminOrderDetailResponse } from '../../../../../shared/adminOrder'

definePageMeta({ layout: false })

const route = useRoute()
const orderId = computed(() => String(route.params.id || ''))
const { data, error, status, refresh } = await useFetch<AdminOrderDetailResponse>(
  () => `/api/admin/orders/${encodeURIComponent(orderId.value)}`,
)
const order = computed(() => data.value?.order || null)
const storeContent = useStoreContent()
const brand = computed(() => storeContent.value.brand)
const printedAutomatically = ref(false)

const money = (value: number) =>
  new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(value)

const date = (value: string) =>
  new Intl.DateTimeFormat('en-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))

const statusLabel = (value: string) =>
  value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const paymentMethod = computed(() =>
  order.value?.paymentMethod === 'cod' ? 'Cash on delivery' : order.value?.paymentMethod || '',
)
const itemCount = computed(
  () => order.value?.lines.reduce((total, line) => total + line.quantity, 0) || 0,
)
const densityClass = computed(() => ({
  'shipping-label--dense': (order.value?.lines.length || 0) > 4,
  'shipping-label--extra-dense': (order.value?.lines.length || 0) > 7,
}))

function printLabel() {
  if (import.meta.client) window.print()
}

watch(
  order,
  async (value) => {
    if (!import.meta.client || !value || printedAutomatically.value) return
    printedAutomatically.value = true
    await nextTick()
    window.setTimeout(() => window.print(), 250)
  },
  { immediate: true },
)

useHead({
  htmlAttrs: { lang: 'en', dir: 'ltr' },
  bodyAttrs: { class: 'kht-shipping-label-body' },
})
useSeoMeta({
  title: () => (order.value ? `${order.value.number} — Shipping label` : 'Shipping label'),
  robots: 'noindex, nofollow',
})
</script>

<template>
  <div class="shipping-label-page">
    <header class="shipping-label-toolbar">
      <div>
        <strong>10 × 15 cm shipping label</strong>
        <span v-if="order">{{ order.number }}</span>
      </div>
      <div>
        <NuxtLink :to="`/admin/orders/${orderId}`">Back to order</NuxtLink>
        <button v-if="order" type="button" @click="printLabel">Print label</button>
      </div>
    </header>

    <main class="shipping-label-preview">
      <div v-if="status === 'pending' && !data" class="shipping-label-state" role="status">
        Loading shipping label…
      </div>
      <div v-else-if="error" class="shipping-label-state" role="alert">
        <strong>Shipping label unavailable</strong>
        <span>Check the connection and try again.</span>
        <button type="button" @click="refresh()">Retry</button>
      </div>
      <div
        v-else-if="data?.availability !== 'available' || !order"
        class="shipping-label-state"
        role="alert"
      >
        {{ data?.message || 'This order is not available.' }}
      </div>

      <article
        v-else
        class="shipping-label"
        :class="densityClass"
        :aria-label="`Shipping label for order ${order.number}`"
      >
        <header class="shipping-label__header">
          <div class="shipping-label__brand">
            <img v-if="brand.logoUrl" :src="brand.logoUrl" :alt="brand.name" />
            <strong v-else>{{ brand.name }}</strong>
            <span>SHIPPING LABEL</span>
          </div>
          <div class="shipping-label__reference">
            <span>ORDER</span>
            <strong>{{ order.number }}</strong>
            <time :datetime="order.createdAt">{{ date(order.createdAt) }}</time>
          </div>
        </header>

        <section class="shipping-label__recipient" aria-labelledby="ship-to-title">
          <h1 id="ship-to-title">SHIP TO / بيانات المستلم</h1>
          <strong dir="auto">{{ order.customerName }}</strong>
          <a :href="`tel:${order.customerPhone}`" dir="ltr">{{ order.customerPhone }}</a>
          <p dir="auto">{{ order.address }}</p>
          <small v-if="order.customerEmail" dir="auto">{{ order.customerEmail }}</small>
        </section>

        <section class="shipping-label__items" aria-labelledby="items-title">
          <div class="shipping-label__section-title">
            <h2 id="items-title">ORDER ITEMS / محتويات الطلب</h2>
            <span>{{ itemCount }} item{{ itemCount === 1 ? '' : 's' }}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th scope="col">Product / Variant</th>
                <th scope="col">Qty</th>
                <th scope="col">Price</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in order.lines" :key="line.id">
                <td>
                  <strong dir="auto">{{ line.productName }}</strong>
                  <span dir="auto">{{ line.variant }}</span>
                </td>
                <td>{{ line.quantity }}</td>
                <td>{{ money(line.unitPrice) }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="shipping-label__summary" aria-label="Order and payment summary">
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{{ money(order.subtotal) }}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>{{ money(order.shipping) }}</dd>
            </div>
            <div v-if="order.discount">
              <dt>
                Discount<template v-if="order.discountCode"> · {{ order.discountCode }}</template>
              </dt>
              <dd>− {{ money(order.discount) }}</dd>
            </div>
            <div>
              <dt>AMOUNT DUE</dt>
              <dd>{{ money(order.total) }}</dd>
            </div>
          </dl>
          <dl>
            <div>
              <dt>Payment</dt>
              <dd>{{ paymentMethod }}</dd>
            </div>
            <div>
              <dt>Payment status</dt>
              <dd>{{ statusLabel(order.paymentStatus) }}</dd>
            </div>
            <div>
              <dt>Order status</dt>
              <dd>{{ statusLabel(order.fulfillmentStatus) }}</dd>
            </div>
        </dl>
        </section>

        <footer class="shipping-label__footer">
          <p v-if="order.notes" dir="auto"><strong>Notes:</strong> {{ order.notes }}</p>
          <div>
            <span>{{ brand.name }} · kht-eg.com</span>
            <span v-if="brand.contactEmail">{{ brand.contactEmail }}</span>
          </div>
        </footer>
      </article>
    </main>
  </div>
</template>

<style>
@page {
  size: 100mm 150mm;
  margin: 0;
}

.kht-shipping-label-body {
  min-width: 320px;
  color: #0a0a0a;
  background: #eaeae7;
  font-family: Arial, 'IBM Plex Sans Arabic', sans-serif;
}

.shipping-label-page {
  min-height: 100vh;
  padding: 24px;
}

.shipping-label-toolbar {
  max-width: 100mm;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 0 auto 18px;
  padding: 10px 12px;
  color: #fff;
  background: #0a0a0a;
}

.shipping-label-toolbar > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.shipping-label-toolbar > div:first-child {
  display: grid;
  gap: 2px;
}

.shipping-label-toolbar strong {
  font-size: 0.75rem;
}

.shipping-label-toolbar span {
  color: #bdbdb9;
  font-size: 0.6875rem;
}

.shipping-label-toolbar :is(a, button),
.shipping-label-state button {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 11px;
  color: inherit;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: 2px;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  text-decoration: none;
}

.shipping-label-toolbar button {
  color: #0a0a0a;
  background: #fff;
}

.shipping-label-preview {
  display: grid;
  justify-items: center;
}

.shipping-label-state {
  width: min(100%, 100mm);
  min-height: 180px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 10px;
  padding: 24px;
  color: #181818;
  background: #fff;
  border: 1px solid #d9d9d6;
  text-align: center;
}

.shipping-label {
  width: 100mm;
  height: 150mm;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto auto;
  gap: 3mm;
  padding: 5mm;
  overflow: hidden;
  color: #0a0a0a;
  background: #fff;
  border: 0.35mm solid #0a0a0a;
  box-shadow: 0 12px 36px rgba(10, 10, 10, 0.16);
  font-size: 9pt;
  line-height: 1.25;
}

.shipping-label *,
.shipping-label *::before,
.shipping-label *::after {
  box-sizing: border-box;
}

.shipping-label :is(h1, h2, p, dl, dt, dd) {
  margin: 0;
}

.shipping-label__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4mm;
  padding-bottom: 3mm;
  border-bottom: 0.6mm solid #0a0a0a;
}

.shipping-label__brand {
  display: grid;
  justify-items: start;
  align-content: space-between;
  gap: 1mm;
}

.shipping-label__brand img {
  display: block;
  width: auto;
  max-width: 28mm;
  height: 9mm;
  object-fit: contain;
  object-position: left center;
  filter: grayscale(1) contrast(1.2);
}

.shipping-label__brand > strong {
  font-family: 'Barlow Condensed', Impact, 'Arial Narrow', sans-serif;
  font-size: 26pt;
  line-height: 0.82;
  letter-spacing: -0.5mm;
}

.shipping-label__brand span,
.shipping-label__reference span,
.shipping-label__section-title h2,
.shipping-label__recipient h1 {
  font-size: 6.5pt;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.shipping-label__reference {
  display: grid;
  justify-items: end;
  align-content: start;
  gap: 1mm;
  text-align: right;
}

.shipping-label__reference strong {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-size: 18pt;
  line-height: 1;
}

.shipping-label__reference time {
  color: #4a4a4a;
  font-size: 6.5pt;
}

.shipping-label__recipient {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1.3mm 3mm;
  padding: 3mm;
  border: 0.35mm solid #0a0a0a;
}

.shipping-label__recipient h1,
.shipping-label__recipient p,
.shipping-label__recipient small {
  grid-column: 1 / -1;
}

.shipping-label__recipient > strong {
  font-size: 12pt;
  line-height: 1.05;
  overflow-wrap: anywhere;
}

.shipping-label__recipient a {
  color: #0a0a0a;
  font-size: 10pt;
  font-weight: 700;
  text-decoration: none;
}

.shipping-label__recipient p {
  font-size: 8.2pt;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.shipping-label__recipient small {
  color: #4a4a4a;
  font-size: 6.5pt;
  overflow-wrap: anywhere;
}

.shipping-label__items {
  min-height: 0;
  overflow: hidden;
}

.shipping-label__section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 3mm;
  margin-bottom: 1.5mm;
}

.shipping-label__section-title span {
  font-size: 6.5pt;
  font-weight: 700;
}

.shipping-label__items table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.shipping-label__items th,
.shipping-label__items td {
  padding: 1.2mm 0;
  border-bottom: 0.2mm solid #a8a8a4;
  text-align: left;
  vertical-align: top;
}

.shipping-label__items th {
  font-size: 6pt;
  text-transform: uppercase;
}

.shipping-label__items :is(th, td):nth-child(2) {
  width: 12mm;
  text-align: center;
}

.shipping-label__items :is(th, td):last-child {
  width: 22mm;
  text-align: right;
}

.shipping-label__items td {
  font-size: 7pt;
}

.shipping-label__items td strong,
.shipping-label__items td span {
  display: block;
  overflow-wrap: anywhere;
}

.shipping-label__items td span {
  margin-top: 0.5mm;
  color: #4a4a4a;
  font-size: 6.2pt;
}

.shipping-label__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4mm;
  padding-top: 2mm;
  border-top: 0.6mm solid #0a0a0a;
}

.shipping-label__summary dl {
  display: grid;
  align-content: start;
  gap: 1mm;
}

.shipping-label__summary dl:first-child {
  padding-right: 4mm;
  border-right: 0.2mm solid #a8a8a4;
}

.shipping-label__summary dl div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 2mm;
}

.shipping-label__summary :is(dt, dd) {
  font-size: 6.5pt;
}

.shipping-label__summary dd {
  font-weight: 700;
  text-align: right;
}

.shipping-label__summary dl:first-child div:last-child {
  margin-top: 1mm;
  padding-top: 1mm;
  border-top: 0.35mm solid #0a0a0a;
}

.shipping-label__summary dl:first-child div:last-child :is(dt, dd) {
  font-size: 9pt;
}

.shipping-label__footer {
  display: grid;
  gap: 1.5mm;
  padding-top: 2mm;
  border-top: 0.2mm solid #0a0a0a;
}

.shipping-label__footer p {
  max-height: 8mm;
  overflow: hidden;
  font-size: 6.2pt;
}

.shipping-label__footer > div {
  display: flex;
  justify-content: space-between;
  gap: 3mm;
  font-size: 6pt;
  font-weight: 700;
}

.shipping-label--dense {
  gap: 2mm;
  padding-block: 4mm;
}

.shipping-label--dense .shipping-label__items :is(th, td) {
  padding-block: 0.8mm;
}

.shipping-label--extra-dense {
  font-size: 8pt;
}

.shipping-label--extra-dense .shipping-label__recipient {
  padding-block: 2mm;
}

.shipping-label--extra-dense .shipping-label__items :is(th, td) {
  padding-block: 0.45mm;
}

@media (max-width: 480px) {
  .shipping-label-page {
    padding: 12px;
  }

  .shipping-label-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .shipping-label-toolbar > div:last-child > * {
    flex: 1;
  }

  .shipping-label-preview {
    justify-items: start;
    overflow-x: auto;
  }

  .shipping-label {
    transform-origin: top left;
  }
}

@media print {
  html,
  body.kht-shipping-label-body {
    width: 100mm;
    height: 150mm;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }

  .shipping-label-page {
    width: 100mm;
    height: 150mm;
    min-height: 0;
    padding: 0;
  }

  .shipping-label-toolbar,
  .shipping-label-state {
    display: none !important;
  }

  .shipping-label-preview,
  .shipping-label {
    width: 100mm;
    height: 150mm;
    margin: 0;
  }

  .shipping-label {
    border: 0;
    box-shadow: none;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
</style>
