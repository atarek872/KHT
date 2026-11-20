<script setup lang="ts">
import type {
  AdminOrderListResponse,
  AdminOrderSummary,
  OrderFulfillmentStatus,
} from '../../../../shared/adminOrder'
import { ORDER_FULFILLMENT_STATUSES } from '#shared/adminOrder'
import OrderStatus from '../../../components/admin/orders/OrderStatus.vue'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Orders — KHT Admin', robots: 'noindex, nofollow' })

const route = useRoute()
const initialStatus =
  typeof route.query.status === 'string' &&
  ORDER_FULFILLMENT_STATUSES.includes(route.query.status as OrderFulfillmentStatus)
    ? route.query.status
    : ''
const selectedStatus = ref(initialStatus)
const searchDraft = ref(typeof route.query.q === 'string' ? route.query.q : '')
const searchQuery = ref(searchDraft.value.trim())
const page = ref(1)
const { data, error, status, refresh } = await useFetch<AdminOrderListResponse>(
  '/api/admin/orders',
  {
    query: { status: selectedStatus, q: searchQuery, page },
    watch: [selectedStatus, searchQuery, page],
  },
)
const totalPages = computed(() =>
  Math.max(1, Math.ceil((data.value?.total || 0) / (data.value?.pageSize || 25))),
)
const statusLabels: Record<OrderFulfillmentStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  'out-for-delivery': 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
}
const statusCounts = computed(() => data.value?.statusCounts)
const allOrders = computed(() =>
  Object.values(statusCounts.value || {}).reduce((sum, count) => sum + count, 0),
)
const onDelivery = computed(
  () => (statusCounts.value?.shipped || 0) + (statusCounts.value?.['out-for-delivery'] || 0),
)
const inventoryGroups = computed(() => {
  const groups = new Map<string, NonNullable<AdminOrderListResponse['inventory']>>()
  for (const item of data.value?.inventory || []) {
    const key = item.category
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }
  return [...groups.entries()].map(([category, items]) => ({ category, items }))
})
function categoryLabel(category: string) {
  return (
    (
      { 'full-sets': 'Full sets', hoodies: 'Hoodies', sweatpants: 'Pants' } as Record<
        string,
        string
      >
    )[category] || category.replaceAll('-', ' ')
  )
}
function chooseStatus(value: string) {
  selectedStatus.value = value
  page.value = 1
}
function search() {
  searchQuery.value = searchDraft.value.trim().slice(0, 80)
  page.value = 1
}
const pendingDeleteOrder = ref<AdminOrderSummary | null>(null)
const deleteBusy = ref(false)
const deleteError = ref('')
const deletedQuery = Array.isArray(route.query.deleted)
  ? route.query.deleted[0]
  : route.query.deleted
const deleteSuccess = ref(
  typeof deletedQuery === 'string' && deletedQuery
    ? `${deletedQuery} was permanently deleted.`
    : '',
)

function requestOrderDelete(order: AdminOrderSummary) {
  deleteError.value = ''
  deleteSuccess.value = ''
  pendingDeleteOrder.value = order
}

function closeDeleteDialog() {
  if (!deleteBusy.value) pendingDeleteOrder.value = null
}

async function deleteSelectedOrder() {
  const target = pendingDeleteOrder.value
  if (!target || deleteBusy.value) return
  deleteBusy.value = true
  deleteError.value = ''
  deleteSuccess.value = ''
  try {
    await $fetch(`/api/admin/orders/${encodeURIComponent(target.id)}`, {
      method: 'DELETE',
      body: { orderNumber: target.number },
    })
    pendingDeleteOrder.value = null
    await refresh()
    deleteSuccess.value = `${target.number} was permanently deleted.`
  } catch (cause: unknown) {
    const failure = cause as { data?: { statusMessage?: string } }
    deleteError.value =
      failure.data?.statusMessage || 'The order could not be deleted. Refresh and try again.'
  } finally {
    deleteBusy.value = false
  }
}
const money = (value: number) =>
  new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(value)
const date = (value: string) =>
  new Intl.DateTimeFormat('en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
</script>

<template>
  <div class="admin-shell__page admin-orders-page">
    <AdminPageHeader
      eyebrow="KHT / Operations"
      title="Orders"
      description="Review payments, fulfillment, and order sources."
    >
      <template #actions>
        <button type="button" class="admin-button admin-button--quiet" @click="refresh()">
          Refresh numbers
        </button>
        <NuxtLink to="/admin/orders/new" class="admin-button admin-button--primary">
          Create order <KhtIcon name="arrow" />
        </NuxtLink>
      </template>
    </AdminPageHeader>

    <p v-if="deleteError" class="admin-create-order__error" role="alert">
      {{ deleteError }}
    </p>
    <p v-if="deleteSuccess" class="admin-order-action__success" role="status">
      {{ deleteSuccess }}
    </p>

    <div v-if="status === 'pending' && !data" class="admin-orders-loading" role="status">
      <AdminLoader label="Loading orders" />
      <span aria-hidden="true" />
    </div>

    <AdminEmptyState
      v-else-if="error"
      title="Orders unavailable"
      description="Orders could not be loaded. Check the server connection and try again."
    >
      <template #actions>
        <AdminButton :loading="status === 'pending'" loading-label="Retrying" @click="refresh()">
          Retry
        </AdminButton>
      </template>
    </AdminEmptyState>

    <AdminEmptyState
      v-else-if="data?.availability === 'unavailable'"
      title="Order data unavailable"
      :description="data.message"
    />

    <AdminEmptyState
      v-else-if="data?.availability === 'empty'"
      title="No orders yet"
      description="New orders will appear here after checkout."
    />

    <template v-else-if="data">
      <section class="admin-orders-overview" aria-label="Order totals">
        <div>
          <span>All orders</span><strong>{{ allOrders }}</strong
          ><small>All time</small>
        </div>
        <div>
          <span>Pending orders</span><strong>{{ statusCounts?.pending || 0 }}</strong
          ><small>Awaiting confirmation</small>
        </div>
        <div>
          <span>On delivery</span><strong>{{ onDelivery }}</strong
          ><small>Shipped or out for delivery</small>
        </div>
        <div>
          <span>Delivered / sold</span><strong>{{ statusCounts?.delivered || 0 }}</strong
          ><small>Completed deliveries</small>
        </div>
      </section>

      <section
        v-if="inventoryGroups.length"
        class="admin-orders-stock"
        aria-labelledby="admin-orders-stock-title"
      >
        <div class="admin-orders-section-heading">
          <div>
            <h2 id="admin-orders-stock-title">Orders and stock by size</h2>
            <p>
              Pending and open quantities are items in orders. Available stock is the current
              inventory record; orders already reserve stock.
            </p>
          </div>
          <NuxtLink to="/admin/inventory">Manage inventory</NuxtLink>
        </div>
        <div class="admin-orders-stock__grid">
          <article
            v-for="group in inventoryGroups"
            :key="group.category"
            class="admin-orders-stock__group"
          >
            <h3>{{ categoryLabel(group.category) }}</h3>
            <div class="admin-orders-stock__head" aria-hidden="true">
              <span>Size</span><span>Pending</span><span>Open</span><span>In stock</span>
            </div>
            <div v-for="item in group.items" :key="item.id" class="admin-orders-stock__row">
              <span :title="`${item.productName} · ${item.color}`"
                >{{ item.size }} <small>{{ item.color }}</small></span
              >
              <strong
                :aria-label="`${item.pendingQuantity} pending ${item.productName} size ${item.size}`"
                >{{ item.pendingQuantity }}</strong
              >
              <span>{{ item.openQuantity }}</span>
              <strong>{{ item.stock }}</strong>
            </div>
          </article>
        </div>
      </section>

      <section class="admin-orders-list" aria-labelledby="admin-orders-list-title">
        <div class="admin-orders-section-heading">
          <div>
            <h2 id="admin-orders-list-title">Order list</h2>
            <p>{{ data.total }} {{ data.total === 1 ? 'order' : 'orders' }} in this view</p>
          </div>
        </div>
        <form class="admin-orders-search" role="search" @submit.prevent="search">
          <label for="admin-order-search">Find an order</label>
          <div>
            <input
              id="admin-order-search"
              v-model="searchDraft"
              type="search"
              maxlength="80"
              placeholder="Order number, customer, or phone"
            />
            <button type="submit" class="admin-button admin-button--secondary">Search</button>
          </div>
        </form>
        <div class="admin-orders-status-filters" role="group" aria-label="Filter orders by status">
          <button type="button" :aria-pressed="selectedStatus === ''" @click="chooseStatus('')">
            All <span>{{ allOrders }}</span>
          </button>
          <button
            v-for="itemStatus in ORDER_FULFILLMENT_STATUSES"
            :key="itemStatus"
            type="button"
            :aria-pressed="selectedStatus === itemStatus"
            @click="chooseStatus(itemStatus)"
          >
            {{ statusLabels[itemStatus] }} <span>{{ statusCounts?.[itemStatus] || 0 }}</span>
          </button>
        </div>
      </section>

      <AdminEmptyState
        v-if="!data.items.length"
        title="No matching orders"
        description="Try another status or search term."
      />

      <div v-if="data.items.length" class="admin-orders-desktop">
        <AdminTable label="Orders">
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Customer</th>
              <th scope="col">Total</th>
              <th scope="col">Payment</th>
              <th scope="col">Payment status</th>
              <th scope="col">Fulfillment</th>
              <th scope="col">Source</th>
              <th scope="col">Date</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in data.items" :key="order.id">
              <td>
                <NuxtLink :to="`/admin/orders/${order.id}`">{{ order.number }}</NuxtLink>
              </td>
              <td>
                <strong>{{ order.customerName }}</strong>
                <span>{{ order.customerPhone }}</span>
              </td>
              <td>{{ money(order.total) }}</td>
              <td>{{ order.paymentMethod.toUpperCase() }}</td>
              <td><OrderStatus :value="order.paymentStatus" label="Payment status" /></td>
              <td>
                <OrderStatus :value="order.fulfillmentStatus" label="Fulfillment status" />
              </td>
              <td>{{ order.source }}</td>
              <td>{{ date(order.createdAt) }}</td>
              <td>
                <div class="admin-order-row__actions">
                  <NuxtLink
                    :to="`/admin/orders/${order.id}/print`"
                    target="_blank"
                    rel="noopener"
                    class="admin-order-print-link"
                    :aria-label="`Print 10 by 15 centimetre label for ${order.number}`"
                  >
                    Print label
                  </NuxtLink>
                  <button
                    v-if="order.canDelete"
                    type="button"
                    class="admin-button admin-button--quiet admin-order-delete-action"
                    :aria-label="`Delete ${order.number} permanently`"
                    :disabled="deleteBusy"
                    @click="requestOrderDelete(order)"
                  >
                    <KhtIcon name="trash" /> Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </AdminTable>
      </div>

      <div v-if="data.items.length" class="admin-orders-mobile" aria-label="Orders">
        <article v-for="order in data.items" :key="order.id" class="admin-order-card">
          <div class="admin-order-card__heading">
            <NuxtLink :to="`/admin/orders/${order.id}`">
              <strong>{{ order.number }}</strong>
            </NuxtLink>
            <span>{{ money(order.total) }}</span>
          </div>
          <div class="admin-order-card__customer">
            <strong>{{ order.customerName }}</strong>
            <span>{{ order.customerPhone }}</span>
          </div>
          <dl>
            <div>
              <dt>Payment</dt>
              <dd>{{ order.paymentMethod.toUpperCase() }}</dd>
            </div>
            <div>
              <dt>Payment status</dt>
              <dd>{{ order.paymentStatus }}</dd>
            </div>
            <div>
              <dt>Fulfillment</dt>
              <dd>{{ order.fulfillmentStatus }}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{{ order.source }}</dd>
            </div>
          </dl>
          <time :datetime="order.createdAt">{{ date(order.createdAt) }}</time>
          <div class="admin-order-card__actions">
            <NuxtLink :to="`/admin/orders/${order.id}`" class="admin-button admin-button--quiet">
              View order
            </NuxtLink>
            <NuxtLink
              :to="`/admin/orders/${order.id}/print`"
              target="_blank"
              rel="noopener"
              class="admin-button admin-button--secondary"
              :aria-label="`Print 10 by 15 centimetre label for ${order.number}`"
            >
              Print label
            </NuxtLink>
            <button
              v-if="order.canDelete"
              type="button"
              class="admin-button admin-button--quiet admin-order-delete-action"
              :aria-label="`Delete ${order.number} permanently`"
              :disabled="deleteBusy"
              @click="requestOrderDelete(order)"
            >
              <KhtIcon name="trash" /> Delete
            </button>
          </div>
        </article>
      </div>
      <nav v-if="totalPages > 1" class="admin-orders-pagination" aria-label="Order pages">
        <button
          type="button"
          class="admin-button admin-button--quiet"
          :disabled="page <= 1 || status === 'pending'"
          @click="page--"
        >
          Previous
        </button>
        <span>Page {{ page }} of {{ totalPages }}</span>
        <button
          type="button"
          class="admin-button admin-button--quiet"
          :disabled="page >= totalPages || status === 'pending'"
          @click="page++"
        >
          Next
        </button>
      </nav>
    </template>

    <AdminConfirmDialog
      :open="!!pendingDeleteOrder"
      title="Delete this order permanently?"
      :description="`This removes ${pendingDeleteOrder?.number}, its history, and its discount redemption. This cannot be undone.`"
      confirm-label="Delete permanently"
      :required-confirmation="
        pendingDeleteOrder?.fulfillmentStatus === 'cancelled'
          ? ''
          : pendingDeleteOrder?.number || ''
      "
      :confirmation-prompt="`Type ${pendingDeleteOrder?.number || ''} to confirm.`"
      danger
      :busy="deleteBusy"
      @close="closeDeleteDialog"
      @confirm="deleteSelectedOrder"
    />
  </div>
</template>
