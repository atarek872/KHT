<script setup lang="ts">
import type {
  AdminOrderDetailResponse,
  OrderFulfillmentStatus,
} from '../../../../shared/adminOrder'
import AdminConfirmDialog from '../../../components/admin/AdminConfirmDialog.vue'
import OrderStatus from '../../../components/admin/orders/OrderStatus.vue'

definePageMeta({ layout: 'admin' })
const route = useRoute()
const orderId = computed(() => String(route.params.id || ''))
const { data, error, status, refresh } = await useFetch<AdminOrderDetailResponse>(
  () => `/api/admin/orders/${encodeURIComponent(orderId.value)}`,
)
const order = computed(() => data.value?.order || null)
const mutationBusy = ref(false)
const activeMutation = ref<OrderFulfillmentStatus | 'restock' | null>(null)
const mutationError = ref('')
const mutationSuccess = ref('')
const pendingAction = ref<
  { kind: 'transition'; status: OrderFulfillmentStatus } | { kind: 'restock' } | null
>(null)

const statusLabel = (value: string) =>
  value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

function requestTransition(nextStatus: OrderFulfillmentStatus) {
  mutationError.value = ''
  mutationSuccess.value = ''
  if (nextStatus === 'cancelled') {
    pendingAction.value = { kind: 'transition', status: nextStatus }
    return
  }
  void updateStatus(nextStatus)
}

async function updateStatus(nextStatus: OrderFulfillmentStatus) {
  if (mutationBusy.value) return
  mutationBusy.value = true
  activeMutation.value = nextStatus
  mutationError.value = ''
  mutationSuccess.value = ''
  try {
    await $fetch(`/api/admin/orders/${encodeURIComponent(orderId.value)}`, {
      method: 'PATCH',
      body: { fulfillmentStatus: nextStatus },
    })
    await refresh()
    mutationSuccess.value = `Order moved to ${statusLabel(nextStatus)}.`
  } catch (cause: unknown) {
    const failure = cause as { data?: { statusMessage?: string } }
    mutationError.value =
      failure.data?.statusMessage || 'The order status could not be updated. Refresh and try again.'
  } finally {
    mutationBusy.value = false
    activeMutation.value = null
  }
}

function requestRestock() {
  mutationError.value = ''
  mutationSuccess.value = ''
  pendingAction.value = { kind: 'restock' }
}

async function restock() {
  if (mutationBusy.value) return
  mutationBusy.value = true
  activeMutation.value = 'restock'
  mutationError.value = ''
  mutationSuccess.value = ''
  try {
    await $fetch(`/api/admin/orders/${encodeURIComponent(orderId.value)}/restock`, {
      method: 'POST',
    })
    await refresh()
    mutationSuccess.value = 'Returned items were added back to inventory.'
  } catch (cause: unknown) {
    const failure = cause as { data?: { statusMessage?: string } }
    mutationError.value =
      failure.data?.statusMessage ||
      'The returned items could not be restocked. Refresh and try again.'
  } finally {
    mutationBusy.value = false
    activeMutation.value = null
  }
}

function confirmPendingAction() {
  const action = pendingAction.value
  pendingAction.value = null
  if (!action) return
  if (action.kind === 'restock') void restock()
  else void updateStatus(action.status)
}

const confirmationTitle = computed(() =>
  pendingAction.value?.kind === 'restock' ? 'Restock returned items?' : 'Cancel this order?',
)
const confirmationDescription = computed(() =>
  pendingAction.value?.kind === 'restock'
    ? 'Confirm only after checking the returned items. Their quantities will be added back to inventory once.'
    : 'This will mark pending COD payment as failed and return all reserved quantities to inventory. This cannot be undone.',
)
const confirmationLabel = computed(() =>
  pendingAction.value?.kind === 'restock' ? 'Confirm restock' : 'Cancel order',
)
const money = (value: number) =>
  new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(value)
const date = (value: string) =>
  new Intl.DateTimeFormat('en-EG', { dateStyle: 'long', timeStyle: 'short' }).format(
    new Date(value),
  )

useSeoMeta({
  title: () => (order.value ? `${order.value.number} — KHT Admin` : 'Order — KHT Admin'),
  robots: 'noindex, nofollow',
})
</script>

<template>
  <div class="admin-shell__page admin-order-detail-page">
    <NuxtLink to="/admin/orders" class="admin-order-back">
      <KhtIcon name="arrow" />
      Back to orders
    </NuxtLink>

    <div v-if="status === 'pending' && !data" class="admin-orders-loading" role="status">
      <AdminLoader label="Loading order" />
      <span aria-hidden="true" />
    </div>

    <AdminEmptyState
      v-else-if="error"
      title="Order unavailable"
      description="The order could not be loaded. Check the server connection and try again."
    >
      <template #actions>
        <AdminButton :loading="status === 'pending'" loading-label="Retrying" @click="refresh()">
          Retry
        </AdminButton>
      </template>
    </AdminEmptyState>

    <AdminEmptyState
      v-else-if="data?.availability !== 'available' || !order"
      title="Order data unavailable"
      :description="data?.message || 'This order is not available.'"
    />

    <template v-else>
      <AdminPageHeader
        eyebrow="Order details"
        :title="order.number"
        :description="date(order.createdAt)"
      />

      <div class="admin-order-detail__status" aria-label="Order statuses">
        <div>
          <span>Payment status</span>
          <OrderStatus :value="order.paymentStatus" />
        </div>
        <div>
          <span>Fulfillment status</span>
          <OrderStatus :value="order.fulfillmentStatus" />
        </div>
        <div>
          <span>Payment method</span><strong>{{ order.paymentMethod.toUpperCase() }}</strong>
        </div>
        <div>
          <span>Source</span><strong>{{ order.source }}</strong>
        </div>
      </div>

      <div class="admin-order-detail__grid">
        <div class="admin-order-detail__main">
          <AdminSection title="Products" description="Exact variants and quantities in this order.">
            <div class="admin-order-lines">
              <div v-for="line in order.lines" :key="line.id" class="admin-order-line">
                <div>
                  <strong>{{ line.productName }}</strong
                  ><span>{{ line.variant }}</span>
                </div>
                <dl>
                  <div>
                    <dt>Quantity</dt>
                    <dd>{{ line.quantity }}</dd>
                  </div>
                  <div>
                    <dt>Unit price</dt>
                    <dd>{{ money(line.unitPrice) }}</dd>
                  </div>
                  <div>
                    <dt>Line total</dt>
                    <dd>{{ money(line.total) }}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </AdminSection>

          <AdminSection v-if="order.notes" title="Notes">
            <p class="admin-order-notes">{{ order.notes }}</p>
          </AdminSection>

          <AdminSection
            title="Order actions"
            description="Only valid next steps are available. Every change is recorded below."
          >
            <p v-if="mutationError" class="admin-create-order__error" role="alert">
              {{ mutationError }}
            </p>
            <p v-if="mutationSuccess" class="admin-order-action__success" role="status">
              {{ mutationSuccess }}
            </p>
            <div
              v-if="order.allowedFulfillmentTransitions.length || order.canRestockReturned"
              class="admin-order-actions"
            >
              <AdminButton
                v-for="nextStatus in order.allowedFulfillmentTransitions"
                :key="nextStatus"
                :variant="nextStatus === 'cancelled' ? 'danger' : 'primary'"
                :disabled="mutationBusy"
                :loading="mutationBusy && activeMutation === nextStatus"
                :loading-label="`Moving to ${statusLabel(nextStatus)}`"
                @click="requestTransition(nextStatus)"
              >
                Mark {{ statusLabel(nextStatus) }}
              </AdminButton>
              <AdminButton
                v-if="order.canRestockReturned"
                variant="secondary"
                :disabled="mutationBusy"
                :loading="mutationBusy && activeMutation === 'restock'"
                loading-label="Restocking items"
                @click="requestRestock"
              >
                Restock inspected items
              </AdminButton>
            </div>
            <p v-else class="admin-order-action__terminal">
              No further fulfillment actions are available for this order.
            </p>
          </AdminSection>

          <AdminSection
            title="Activity"
            description="Status and inventory actions recorded by the server."
          >
            <ol v-if="order.events.length" class="admin-order-timeline">
              <li v-for="event in order.events" :key="event.id">
                <span aria-hidden="true" />
                <div>
                  <strong v-if="event.eventType === 'fulfillment_status'">
                    {{ statusLabel(event.fromValue || 'unknown') }} →
                    {{ statusLabel(event.toValue || 'unknown') }}
                  </strong>
                  <strong v-else-if="event.eventType === 'inventory_restocked'">
                    Returned items restocked
                  </strong>
                  <strong v-else>Order created</strong>
                  <p v-if="event.note">{{ event.note }}</p>
                  <small>{{ event.actorEmail }} · {{ date(event.createdAt) }}</small>
                </div>
              </li>
            </ol>
            <p v-else class="admin-order-action__terminal">No activity has been recorded.</p>
          </AdminSection>
        </div>

        <aside class="admin-order-detail__aside">
          <AdminSection title="Customer">
            <dl class="admin-order-facts">
              <div>
                <dt>Name</dt>
                <dd>{{ order.customerName }}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd dir="ltr">{{ order.customerPhone }}</dd>
              </div>
              <div v-if="order.customerEmail">
                <dt>Email</dt>
                <dd>{{ order.customerEmail }}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{{ order.address }}</dd>
              </div>
            </dl>
          </AdminSection>

          <AdminSection title="Totals">
            <dl class="admin-order-totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{{ money(order.subtotal) }}</dd>
              </div>
              <div>
                <dt>Shipping</dt>
                <dd>{{ money(order.shipping) }}</dd>
              </div>
              <div>
                <dt>
                  Discount<template v-if="order.discountCode"> · {{ order.discountCode }}</template>
                </dt>
                <dd>− {{ money(order.discount) }}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{{ money(order.total) }}</dd>
              </div>
            </dl>
          </AdminSection>
        </aside>
      </div>
    </template>

    <AdminConfirmDialog
      :open="!!pendingAction"
      :title="confirmationTitle"
      :description="confirmationDescription"
      :confirm-label="confirmationLabel"
      :danger="pendingAction?.kind !== 'restock'"
      :busy="mutationBusy"
      @close="pendingAction = null"
      @confirm="confirmPendingAction"
    />
  </div>
</template>
