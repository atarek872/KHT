<script setup lang="ts">
import type { CreateOrderInput, CreateOrderResources, CreateOrderResult } from '../../../../shared/createOrder'
import type { OrderQuote } from '../../../../shared/discount'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Create Order — KHT Admin', robots: 'noindex, nofollow' })

const { data: resources, error: resourcesError, status, refresh } =
  await useFetch<CreateOrderResources>('/api/admin/orders/resources')
const step = ref(1)
const busy = ref(false)
const error = ref('')
const result = ref<CreateOrderResult | null>(null)
const quote = ref<OrderQuote | null>(null)
const customerQuery = ref('')
const customerResults = ref<CreateOrderInput['customer'][]>([])
const customerSearching = ref(false)
const productQuery = ref('')
const selectedVariantId = ref('')
const selectedQuantity = ref(1)
const requestId = ref(crypto.randomUUID())
const form = reactive<CreateOrderInput>({
  requestId: requestId.value,
  customer: { name: '', phone: '', email: '', address: '', governorate: '', city: '' },
  items: [],
  shippingGovernorate: '',
  paymentMethod: 'cod',
  source: 'instagram',
  couponCode: '',
  notes: '',
})

const steps = ['Customer', 'Products', 'Shipping', 'Payment', 'Review']
const filteredVariants = computed(() => {
  const query = productQuery.value.trim().toLowerCase()
  return (resources.value?.variants || []).filter((variant) =>
    !query || `${variant.productName} ${variant.sku} ${variant.size} ${variant.color}`.toLowerCase().includes(query),
  )
})
const selectedLines = computed(() => form.items.flatMap((item) => {
  const variant = resources.value?.variants.find((entry) => entry.id === item.variantId)
  return variant ? [{ ...item, variant }] : []
}))
const shippingRate = computed(() => resources.value?.shipping.find(
  (option) => option.governorate === form.shippingGovernorate,
)?.rate ?? null)
const subtotal = computed(() => selectedLines.value.reduce(
  (sum, line) => sum + line.variant.unitPrice * line.quantity, 0,
))
const money = (value: number) => new Intl.NumberFormat('en-EG', {
  style: 'currency', currency: 'EGP', maximumFractionDigits: 0,
}).format(value)

async function next() {
  error.value = ''
  if (step.value === 1 && (!form.customer.name || !form.customer.phone || !form.customer.address || !form.customer.city))
    return void (error.value = 'Complete the customer name, phone, address, and city.')
  if (step.value === 2 && !form.items.length) return void (error.value = 'Add at least one product variant.')
  if (step.value === 3 && shippingRate.value === null) return void (error.value = 'Choose an available shipping zone.')
  if (step.value === 4) {
    try {
      quote.value = await $fetch<OrderQuote>('/api/admin/orders/quote', { method: 'POST', body: form })
      if (quote.value.couponCode) form.couponCode = quote.value.couponCode
    } catch (cause: unknown) {
      error.value = (cause as { data?: { statusMessage?: string } }).data?.statusMessage || 'The order could not be quoted.'
      return
    }
  }
  step.value = Math.min(5, step.value + 1)
}

function addProduct() {
  const variant = resources.value?.variants.find((entry) => entry.id === selectedVariantId.value)
  if (!variant || selectedQuantity.value < 1 || selectedQuantity.value > variant.stock) {
    error.value = 'Choose an available variant and quantity.'
    return
  }
  const existing = form.items.find((item) => item.variantId === variant.id)
  const quantity = (existing?.quantity || 0) + selectedQuantity.value
  if (quantity > variant.stock || quantity > 10) return void (error.value = 'Quantity exceeds available stock.')
  if (existing) existing.quantity = quantity
  else form.items.push({ variantId: variant.id, quantity })
  selectedVariantId.value = ''
  selectedQuantity.value = 1
  error.value = ''
}

async function searchCustomers() {
  if (customerQuery.value.trim().length < 2) return
  customerSearching.value = true
  try {
    const response = await $fetch<{ items: CreateOrderInput['customer'][] }>('/api/admin/customers', {
      query: { q: customerQuery.value, mode: 'lookup' },
    })
    customerResults.value = response.items
  } finally {
    customerSearching.value = false
  }
}

function chooseCustomer(customer: CreateOrderInput['customer']) {
  Object.assign(form.customer, customer)
  customerResults.value = []
  customerQuery.value = ''
}

async function submit() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    result.value = await $fetch<CreateOrderResult>('/api/admin/orders', { method: 'POST', body: form })
  } catch (cause: unknown) {
    const failure = cause as { data?: { statusMessage?: string } }
    error.value = failure.data?.statusMessage || 'The order could not be created. Review the details and try again.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="admin-shell__page admin-create-order">
    <AdminPageHeader eyebrow="Orders / New" title="Create order" description="Create a standard order for social or offline sales." />

    <div v-if="status === 'pending' && !resources" class="admin-orders-loading" role="status">
      <AdminLoader label="Loading order resources" /><span aria-hidden="true" />
    </div>
    <AdminEmptyState v-else-if="resourcesError" title="Order creation unavailable"
      description="Products and shipping configuration could not be loaded.">
      <template #actions><AdminButton @click="refresh()">Retry</AdminButton></template>
    </AdminEmptyState>
    <AdminEmptyState v-else-if="result" title="Order created" :description="`${result.order.number} was created and inventory was updated.`">
      <template #actions>
        <NuxtLink :to="`/admin/orders/${result.order.id}`" class="admin-button admin-button--primary">View order <KhtIcon name="arrow" /></NuxtLink>
      </template>
    </AdminEmptyState>

    <template v-else-if="resources">
      <nav class="admin-create-order__steps" aria-label="Create order progress">
        <button v-for="(label, index) in steps" :key="label" type="button"
          :aria-current="step === index + 1 ? 'step' : undefined" :disabled="index + 1 > step" @click="step = index + 1">
          <span>{{ String(index + 1).padStart(2, '0') }}</span>{{ label }}
        </button>
      </nav>

      <form class="admin-create-order__form" @submit.prevent="submit">
        <AdminSection v-if="step === 1" title="Customer" description="Find an existing customer by phone or create one now.">
          <div class="admin-create-order__search">
            <AdminInput v-model="customerQuery" label="Find customer" placeholder="Phone or name" />
            <AdminButton variant="secondary" :loading="customerSearching" loading-label="Searching" @click="searchCustomers">Search</AdminButton>
          </div>
          <div v-if="customerResults.length" class="admin-create-order__results">
            <button v-for="customer in customerResults" :key="customer.phone" type="button" @click="chooseCustomer(customer)">
              <strong>{{ customer.name }}</strong><span>{{ customer.phone }}</span>
            </button>
          </div>
          <div class="admin-create-order__fields">
            <AdminInput v-model="form.customer.name" label="Name" required autocomplete="name" />
            <AdminInput v-model="form.customer.phone" label="Phone" required type="tel" autocomplete="tel" />
            <AdminInput v-model="form.customer.email" label="Email" type="email" optional autocomplete="email" />
            <AdminInput v-model="form.customer.address" label="Address" required autocomplete="street-address" />
            <AdminInput v-model="form.customer.city" label="Area / city" required autocomplete="address-level2" />
          </div>
        </AdminSection>

        <AdminSection v-else-if="step === 2" title="Products" description="Select exact variants. Prices and stock come from the server.">
          <div class="admin-create-order__product-picker">
            <AdminInput v-model="productQuery" label="Find product" placeholder="Product, SKU, size, or color" />
            <AdminSelect v-model="selectedVariantId" label="Exact variant">
              <option value="">Choose a variant</option>
              <option v-for="variant in filteredVariants" :key="variant.id" :value="variant.id" :disabled="variant.stock < 1">
                {{ variant.productName }} — {{ variant.color }} / {{ variant.size }} — {{ variant.sku }} — {{ variant.stock }} in stock
              </option>
            </AdminSelect>
            <div class="admin-field">
              <label class="admin-field__label" for="admin-order-quantity">Quantity</label>
              <input id="admin-order-quantity" v-model.number="selectedQuantity" class="admin-field__control"
                type="number" min="1" max="10" inputmode="numeric" />
            </div>
            <AdminButton variant="secondary" @click="addProduct">Add product</AdminButton>
          </div>
          <div class="admin-create-order__lines">
            <div v-for="line in selectedLines" :key="line.variantId">
              <div><strong>{{ line.variant.productName }}</strong><span>{{ line.variant.color }} / {{ line.variant.size }} · {{ line.variant.sku }}</span></div>
              <span>{{ line.quantity }} × {{ money(line.variant.unitPrice) }}</span>
              <button type="button" aria-label="Remove product" @click="form.items = form.items.filter((item) => item.variantId !== line.variantId)"><KhtIcon name="close" /></button>
            </div>
          </div>
        </AdminSection>

        <AdminSection v-else-if="step === 3" title="Shipping" description="Rates come from enabled server configuration.">
          <AdminSelect v-model="form.shippingGovernorate" label="Governorate" required @update:model-value="form.customer.governorate = String($event)">
            <option value="">Choose a shipping zone</option>
            <option v-for="option in resources.shipping" :key="option.governorate" :value="option.governorate">{{ option.governorate }} — {{ money(option.rate) }}</option>
          </AdminSelect>
        </AdminSection>

        <AdminSection v-else-if="step === 4" title="Payment" description="Manual Paymob payments are not supported.">
          <div class="admin-create-order__fields">
            <AdminSelect v-model="form.paymentMethod" label="Payment method"><option value="cod">Cash on delivery</option></AdminSelect>
            <AdminSelect v-model="form.source" label="Order source">
              <option v-for="source in resources.sources" :key="source" :value="source">{{ source.toUpperCase() }}</option>
            </AdminSelect>
            <AdminInput v-model="form.couponCode" label="Coupon code" optional placeholder="WELCOME10" />
            <AdminTextarea v-model="form.notes" label="Notes" optional />
          </div>
        </AdminSection>

        <AdminSection v-else title="Review" description="The server will verify prices, shipping, and stock again.">
          <div class="admin-create-order__review">
            <dl><div><dt>Customer</dt><dd>{{ form.customer.name }} · {{ form.customer.phone }}</dd></div>
              <div><dt>Address</dt><dd>{{ form.customer.address }}, {{ form.customer.city }}, {{ form.shippingGovernorate }}</dd></div>
              <div><dt>Payment</dt><dd>Cash on delivery · Pending</dd></div><div><dt>Source</dt><dd>{{ form.source.toUpperCase() }}</dd></div></dl>
            <div class="admin-create-order__review-lines"><div v-for="line in selectedLines" :key="line.variantId">
              <span>{{ line.variant.productName }} · {{ line.variant.color }} / {{ line.variant.size }} × {{ line.quantity }}</span><strong>{{ money(line.variant.unitPrice * line.quantity) }}</strong>
            </div></div>
            <dl class="admin-order-totals"><div><dt>Subtotal</dt><dd>{{ money(quote?.subtotal ?? subtotal) }}</dd></div>
              <div><dt>Discount<template v-if="quote?.couponCode"> · {{ quote.couponCode }}</template></dt><dd>− {{ money(quote?.discount || 0) }}</dd></div><div><dt>Shipping</dt><dd>{{ money(quote?.shipping ?? shippingRate ?? 0) }}</dd></div>
              <div><dt>Total</dt><dd>{{ money(quote?.total ?? 0) }}</dd></div></dl>
          </div>
        </AdminSection>

        <p v-if="error" class="admin-create-order__error" role="alert">{{ error }}</p>
        <footer class="admin-create-order__actions">
          <AdminButton v-if="step > 1" variant="quiet" :disabled="busy" @click="step--">Back</AdminButton>
          <AdminButton v-if="step < 5" @click="next">Continue</AdminButton>
          <AdminButton v-else type="submit" :loading="busy" loading-label="Creating order">Create order</AdminButton>
        </footer>
      </form>
    </template>
  </div>
</template>