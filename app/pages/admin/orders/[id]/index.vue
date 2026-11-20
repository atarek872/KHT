<script setup lang="ts">
import type {
  AdminOrderDetailResponse,
  OrderFulfillmentStatus,
  OrderSource,
} from '../../../../../shared/adminOrder'
import { ORDER_SOURCES } from '#shared/adminOrder'
import AdminConfirmDialog from '../../../../components/admin/AdminConfirmDialog.vue'
import OrderStatus from '../../../../components/admin/orders/OrderStatus.vue'

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
const sourceBusy = ref(false)
const exchangeSource = ref<{
  orderItemId: string
  variantId: string
  productId: string
  productName: string
  size: string
  color: string
  quantity: number
} | null>(null)
const exchangeTargetId = ref('')
const exchangeQuantity = ref(1)
const exchangeReceived = ref(false)
const exchangeNote = ref('')
const exchangeRequestId = ref(crypto.randomUUID())
const exchangeBusy = ref(false)
const exchangeError = ref('')
const exchangeSuccess = ref('')
const exchangeTargets = computed(() =>
  (order.value?.componentOptions || []).filter(
    (item) =>
      item.productId === exchangeSource.value?.productId &&
      item.color === exchangeSource.value?.color &&
      item.id !== exchangeSource.value?.variantId,
  ),
)
const exchangeNeedsReturn = computed(() =>
  ['shipped', 'out-for-delivery', 'delivered'].includes(order.value?.fulfillmentStatus || ''),
)

function startExchange(
  orderItemId: string,
  component: NonNullable<NonNullable<typeof order.value>['lines'][number]['components']>[number],
) {
  exchangeSource.value = { orderItemId, ...component }
  exchangeTargetId.value = ''
  exchangeQuantity.value = 1
  exchangeReceived.value = false
  exchangeNote.value = ''
  exchangeError.value = ''
  exchangeSuccess.value = ''
  exchangeRequestId.value = crypto.randomUUID()
}

async function submitExchange() {
  if (!order.value || !exchangeSource.value || !exchangeTargetId.value || exchangeBusy.value) return
  if (exchangeNeedsReturn.value && !exchangeReceived.value) {
    exchangeError.value = 'Confirm that the returned piece is in hand before changing stock.'
    return
  }
  exchangeBusy.value = true
  exchangeError.value = ''
  try {
    await $fetch(`/api/admin/orders/${encodeURIComponent(orderId.value)}/exchange`, {
      method: 'POST',
      body: {
        requestId: exchangeRequestId.value,
        orderItemId: exchangeSource.value.orderItemId,
        fromVariantId: exchangeSource.value.variantId,
        toVariantId: exchangeTargetId.value,
        quantity: exchangeQuantity.value,
        returnedReceived: exchangeReceived.value,
        note: exchangeNote.value.trim() || undefined,
      },
    })
    await refresh()
    exchangeSource.value = null
    exchangeRequestId.value = crypto.randomUUID()
    exchangeSuccess.value = 'Size exchanged and inventory updated.'
  } catch (cause: unknown) {
    const failure = cause as { data?: { statusMessage?: string } }
    exchangeError.value =
      failure.data?.statusMessage || 'The exchange could not be saved. Refresh and try again.'
  } finally {
    exchangeBusy.value = false
  }
}
const sourceDraft = ref<OrderSource>('website')
watch(
  order,
  (value) => {
    if (value) sourceDraft.value = value.source
  },
  { immediate: true },
)
async function saveSource() {
  if (!order.value || sourceBusy.value || sourceDraft.value === order.value.source) return
  sourceBusy.value = true
  mutationError.value = ''
  mutationSuccess.value = ''
  try {
    await $fetch(`/api/admin/orders/${encodeURIComponent(orderId.value)}/source`, {
      method: 'PATCH',
      body: { source: sourceDraft.value },
    })
    await refresh()
    mutationSuccess.value = 'Order source updated.'
  } catch (cause: unknown) {
    const failure = cause as { data?: { statusMessage?: string } }
    mutationError.value = failure.data?.statusMessage || 'Could not update order source.'
  } finally {
    sourceBusy.value = false
  }
}
const deleteDialogOpen = ref(false)
const deleteBusy = ref(false)
const deleteError = ref('')
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

function requestDelete() {
  deleteError.value = ''
  deleteDialogOpen.value = true
}

function closeDeleteDialog() {
  if (!deleteBusy.value) deleteDialogOpen.value = false
}

async function deleteOrder() {
  const target = order.value
  if (!target || deleteBusy.value) return
  deleteBusy.value = true
  deleteError.value = ''
  try {
    await $fetch(`/api/admin/orders/${encodeURIComponent(target.id)}`, {
      method: 'DELETE',
      body: { orderNumber: target.number },
    })
    await navigateTo(`/admin/orders?deleted=${encodeURIComponent(target.number)}`)
  } catch (cause: unknown) {
    const failure = cause as { data?: { statusMessage?: string } }
    deleteError.value =
      failure.data?.statusMessage || 'The order could not be deleted. Refresh and try again.'
  } finally {
    deleteBusy.value = false
  }
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
    if (import.meta.client) reloadNuxtApp({ force: true })
    else mutationSuccess.value = `Order moved to ${statusLabel(nextStatus)}.`
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
      >
        <template #actions>
          <NuxtLink
            :to="`/admin/orders/${order.id}/print`"
            target="_blank"
            rel="noopener"
            class="admin-button admin-button--secondary"
          >
            Print 10×15 label
          </NuxtLink>
          <button
            v-if="order.canDelete"
            type="button"
            class="admin-button admin-button--quiet admin-order-delete-action"
            :aria-label="`Delete ${order.number} permanently`"
            :disabled="mutationBusy || deleteBusy"
            @click="requestDelete"
          >
            <KhtIcon name="trash" /> Delete
          </button>
        </template>
      </AdminPageHeader>

      <p v-if="deleteError" class="admin-create-order__error" role="alert">
        {{ deleteError }}
      </p>

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

      <div class="admin-order-source-editor">
        <label for="order-source">Order source</label>
        <select id="order-source" v-model="sourceDraft" :disabled="sourceBusy">
          <option v-for="source in ORDER_SOURCES" :key="source" :value="source">
            {{ statusLabel(source) }}
          </option>
        </select>
        <AdminButton
          type="button"
          variant="secondary"
          :disabled="sourceBusy || sourceDraft === order.source"
          :loading="sourceBusy"
          @click="saveSource"
          >Save source</AdminButton
        >
        <p>Correct the sales channel at any time. Campaign tracking stays unchanged.</p>
      </div>

      <div class="admin-order-detail__grid">
        <div class="admin-order-detail__main">
          <AdminSection title="Products" description="Exact variants and quantities in this order.">
            <div class="admin-order-lines">
              <div v-for="line in order.lines" :key="line.id" class="admin-order-line">
                <div>
                  <strong>{{ line.productName }}</strong
                  ><span>{{ line.variant }}</span>
                  <div v-if="line.components?.length" class="admin-order-components">
                    <div v-for="component in line.components" :key="component.variantId">
                      <span
                        >{{ component.productName }} · {{ component.color }} /
                        {{ component.size }} × {{ component.quantity }}</span
                      >
                      <button
                        v-if="!['cancelled', 'returned'].includes(order.fulfillmentStatus)"
                        type="button"
                        :disabled="exchangeBusy"
                        @click="startExchange(line.id, component)"
                      >
                        Change size
                      </button>
                    </div>
                  </div>
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

          <AdminSection
            v-if="exchangeSource"
            title="Change piece size"
            description="The old size returns to stock and the replacement size is reserved. The order price stays the same."
          >
            <form class="admin-order-exchange" @submit.prevent="submitExchange">
              <p>
                {{ exchangeSource.productName }} · {{ exchangeSource.color }} /
                {{ exchangeSource.size }}
              </p>
              <label for="exchange-target">Replacement size</label>
              <select
                id="exchange-target"
                v-model="exchangeTargetId"
                required
                :disabled="exchangeBusy"
              >
                <option value="">Choose available size</option>
                <option
                  v-for="target in exchangeTargets"
                  :key="target.id"
                  :value="target.id"
                  :disabled="target.stock < 1"
                >
                  {{ target.size }} · {{ target.stock }} available
                </option>
              </select>
              <label for="exchange-quantity">Pieces to change</label>
              <input
                id="exchange-quantity"
                v-model.number="exchangeQuantity"
                type="number"
                min="1"
                :max="exchangeSource.quantity"
                step="1"
                required
                :disabled="exchangeBusy"
              />
              <label v-if="exchangeNeedsReturn" class="admin-order-exchange__received">
                <input
                  v-model="exchangeReceived"
                  type="checkbox"
                  required
                  :disabled="exchangeBusy"
                />
                I have received and checked the returned piece
              </label>
              <label for="exchange-note">Note (optional)</label>
              <textarea
                id="exchange-note"
                v-model="exchangeNote"
                maxlength="500"
                rows="2"
                :disabled="exchangeBusy"
              />
              <p v-if="exchangeError" class="admin-create-order__error" role="alert">
                {{ exchangeError }}
              </p>
              <div class="admin-order-exchange__actions">
                <AdminButton
                  type="submit"
                  :loading="exchangeBusy"
                  loading-label="Saving exchange"
                  :disabled="
                    !exchangeTargetId ||
                    !Number.isInteger(exchangeQuantity) ||
                    exchangeQuantity < 1 ||
                    exchangeQuantity > exchangeSource.quantity ||
                    (exchangeNeedsReturn && !exchangeReceived)
                  "
                  >Confirm size exchange</AdminButton
                >
                <AdminButton
                  type="button"
                  variant="quiet"
                  :disabled="exchangeBusy"
                  @click="exchangeSource = null"
                  >Cancel</AdminButton
                >
              </div>
            </form>
          </AdminSection>
          <p v-if="exchangeSuccess" class="admin-order-action__success" role="status">
            {{ exchangeSuccess }}
          </p>

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
            <p v-if="!order.canDelete" class="admin-order-action__terminal">
              {{ order.deleteBlockReason }}
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
                  <strong v-else-if="event.eventType === 'source_changed'">
                    Source: {{ statusLabel(event.fromValue || 'unknown') }} →
                    {{ statusLabel(event.toValue || 'unknown') }}
                  </strong>
                  <strong v-else-if="event.eventType === 'component_exchanged'">
                    Size exchanged: {{ event.fromValue }} → {{ event.toValue }}
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
                  Discount<template v-if="order.discountCode"> · {{ order.discountCode }}</template
                  ><template v-else-if="order.manualDiscountPercent">
                    · Manual {{ order.manualDiscountPercent }}%</template
                  >
                </dt>
                <dd>− {{ money(order.discount) }}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{{ money(order.total) }}</dd>
              </div>
            </dl>
          </AdminSection>

          <AdminSection
            v-if="order.publicReference"
            title="Attribution & measurement"
            description="Compare this reference and merchandise value with Meta and GA4. Delivery state records the server request."
          >
            <dl class="admin-order-facts">
              <div>
                <dt>Transaction ID</dt>
                <dd dir="ltr">{{ order.publicReference }}</dd>
              </div>
              <div>
                <dt>Merchandise value</dt>
                <dd>{{ money(order.subtotal - order.discount) }}</dd>
              </div>
              <div>
                <dt>Meta CAPI</dt>
                <dd>{{ order.metaDeliveryStatus || 'Not queued' }}</dd>
              </div>
              <div>
                <dt>GA4 backup</dt>
                <dd>{{ order.ga4DeliveryStatus || 'Not queued' }}</dd>
              </div>
              <div v-if="order.attribution?.source">
                <dt>Source</dt>
                <dd>{{ order.attribution.source }}</dd>
              </div>
              <div v-if="order.attribution?.medium">
                <dt>Medium</dt>
                <dd>{{ order.attribution.medium }}</dd>
              </div>
              <div v-if="order.attribution?.campaign">
                <dt>Campaign</dt>
                <dd>{{ order.attribution.campaign }}</dd>
              </div>
              <div v-if="order.attribution?.utmId">
                <dt>UTM ID</dt>
                <dd>{{ order.attribution.utmId }}</dd>
              </div>
              <div v-if="order.attribution?.campaignId">
                <dt>Campaign ID</dt>
                <dd>{{ order.attribution.campaignId }}</dd>
              </div>
              <div v-if="order.attribution?.adsetId">
                <dt>Ad set ID</dt>
                <dd>{{ order.attribution.adsetId }}</dd>
              </div>
              <div v-if="order.attribution?.adId">
                <dt>Ad ID</dt>
                <dd>{{ order.attribution.adId }}</dd>
              </div>
              <div v-if="order.attribution?.content">
                <dt>Content</dt>
                <dd>{{ order.attribution.content }}</dd>
              </div>
              <div v-if="order.attribution?.term">
                <dt>Term</dt>
                <dd>{{ order.attribution.term }}</dd>
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
    <AdminConfirmDialog
      :open="deleteDialogOpen"
      title="Delete this order permanently?"
      :description="`This removes ${order?.number || 'this order'}, its history, and its discount redemption. This cannot be undone.`"
      confirm-label="Delete permanently"
      :required-confirmation="order?.fulfillmentStatus === 'cancelled' ? '' : order?.number || ''"
      :confirmation-prompt="`Type ${order?.number || ''} to confirm.`"
      danger
      :busy="deleteBusy"
      @close="closeDeleteDialog"
      @confirm="deleteOrder"
    />
  </div>
</template>
