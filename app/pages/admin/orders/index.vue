<script setup lang="ts">
import type { AdminOrderListResponse, AdminOrderSummary } from '../../../../shared/adminOrder'
import OrderStatus from '../../../components/admin/orders/OrderStatus.vue'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Orders — KHT Admin', robots: 'noindex, nofollow' })

const { data, error, status, refresh } = await useFetch<AdminOrderListResponse>('/api/admin/orders')
const route = useRoute()
const pendingDeleteOrder = ref<AdminOrderSummary | null>(null)
const deleteBusy = ref(false)
const deleteError = ref('')
const deletedQuery = Array.isArray(route.query.deleted) ? route.query.deleted[0] : route.query.deleted
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
      v-else-if="data?.availability === 'empty' || !data?.items.length"
      title="No orders yet"
      description="Orders will appear here after durable checkout is enabled."
    />

    <template v-else-if="data">
      <div
        v-if="Object.values(data.capabilities).some(Boolean)"
        class="admin-orders-capabilities"
        aria-label="Order search and filters"
      >
        <p>Search and filters are provided only when supported by the order backend.</p>
      </div>

      <div class="admin-orders-desktop">
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
              <td><div class="admin-order-row__actions">
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
                  class="admin-delete-action"
                  :aria-label="`Delete ${order.number} permanently`"
                  :disabled="deleteBusy"
                  @click="requestOrderDelete(order)"
                >
                  <KhtIcon name="trash" />
                </button>
              </div></td>
            </tr>
          </tbody>
        </AdminTable>
      </div>

      <div class="admin-orders-mobile" aria-label="Orders">
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
              class="admin-delete-action"
              :aria-label="`Delete ${order.number} permanently`"
              :disabled="deleteBusy"
              @click="requestOrderDelete(order)"
            >
              <KhtIcon name="trash" />
            </button>
          </div>
        </article>
      </div>
    </template>

    <AdminConfirmDialog
      :open="!!pendingDeleteOrder"
      title="Delete this order permanently?"
      :description="`This removes ${pendingDeleteOrder?.number}, its history, and its discount redemption. This cannot be undone.`"
      confirm-label="Delete permanently"
      :required-confirmation="pendingDeleteOrder?.number || ''"
      :confirmation-prompt="`Type ${pendingDeleteOrder?.number || ''} to confirm.`"
      danger
      :busy="deleteBusy"
      @close="closeDeleteDialog"
      @confirm="deleteSelectedOrder"
    />
  </div>
</template>
