<script setup lang="ts">
import type { AbandonedCartSummary } from '../../../../shared/abandonedCart'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Abandoned Carts — KHT Admin', robots: 'noindex, nofollow' })

const route = useRoute()
const { data, error, status, refresh } = await useFetch<{ items: AbandonedCartSummary[] }>(
  '/api/admin/abandoned-carts',
)
const pendingDeleteCart = ref<AbandonedCartSummary | null>(null)
const deleteBusy = ref(false)
const deleteError = ref('')
const deleteSuccess = ref(
  route.query.deleted === '1' ? 'The abandoned cart was permanently deleted.' : '',
)
const clock = ref(Date.now())
let clockTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  clockTimer = setInterval(() => {
    clock.value = Date.now()
  }, 60000)
})
onBeforeUnmount(() => clearInterval(clockTimer))

function requestDelete(cart: AbandonedCartSummary) {
  deleteError.value = ''
  deleteSuccess.value = ''
  pendingDeleteCart.value = cart
}

function closeDeleteDialog() {
  if (!deleteBusy.value) pendingDeleteCart.value = null
}

async function deleteSelectedCart() {
  const target = pendingDeleteCart.value
  if (!target || deleteBusy.value) return
  deleteBusy.value = true
  deleteError.value = ''
  deleteSuccess.value = ''
  try {
    await $fetch(`/api/admin/abandoned-carts/${encodeURIComponent(target.id)}`, {
      method: 'DELETE',
    })
    pendingDeleteCart.value = null
    await refresh()
    deleteSuccess.value = `${target.customerName || 'Anonymous cart'} was permanently deleted.`
  } catch (cause: unknown) {
    const failure = cause as { data?: { statusMessage?: string } }
    deleteError.value =
      failure.data?.statusMessage ||
      'The abandoned cart could not be deleted. Refresh and try again.'
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
  new Intl.DateTimeFormat('en-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
function relative(value: string) {
  const minutes = Math.max(0, Math.floor((clock.value - new Date(value).getTime()) / 60000))
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.floor(hours / 24)} days ago`
}
</script>

<template>
  <div class="admin-shell__page admin-abandoned-page">
    <AdminPageHeader
      eyebrow="KHT / Operations"
      title="Abandoned carts"
      description="Carts inactive for at least 30 minutes."
    />

    <p v-if="deleteError" class="admin-create-order__error" role="alert">{{ deleteError }}</p>
    <p v-if="deleteSuccess" class="admin-state-notice" role="status">{{ deleteSuccess }}</p>

    <div v-if="status === 'pending' && !data" class="admin-orders-loading" role="status">
      <AdminLoader label="Loading abandoned carts" /><span />
    </div>
    <AdminEmptyState
      v-else-if="error"
      title="Abandoned carts unavailable"
      description="Cart activity could not be loaded."
    >
      <template #actions><AdminButton @click="refresh()">Retry</AdminButton></template>
    </AdminEmptyState>
    <AdminEmptyState
      v-else-if="!data?.items.length"
      title="No abandoned carts"
      description="Inactive carts will appear here after 30 minutes."
    />
    <template v-else-if="data">
      <div class="admin-abandoned-desktop">
        <AdminTable label="Abandoned carts">
          <thead>
            <tr>
              <th scope="col">Customer</th>
              <th scope="col">Value</th>
              <th scope="col">Items</th>
              <th scope="col">Last activity</th>
              <th scope="col">Recovery</th>
              <th scope="col">Created</th>
              <th scope="col"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cart in data.items" :key="cart.id">
              <td>
                <NuxtLink :to="`/admin/abandoned-carts/${cart.id}`">
                  {{ cart.customerName || 'Anonymous cart' }}
                </NuxtLink>
                <span>{{ cart.phone || cart.email || 'No contact captured' }}</span>
              </td>
              <td>{{ money(cart.subtotal) }}</td>
              <td>{{ cart.itemsCount }}</td>
              <td>{{ relative(cart.lastActivity) }}</td>
              <td>
                <AdminBadge :tone="cart.recoveryState === 'recovered' ? 'strong' : 'neutral'">
                  {{ cart.recoveryState }}
                </AdminBadge>
              </td>
              <td>{{ date(cart.createdAt) }}</td>
              <td>
                <button
                  type="button"
                  class="admin-delete-action"
                  :aria-label="`Delete ${cart.customerName || 'anonymous cart'} permanently`"
                  :disabled="deleteBusy"
                  @click="requestDelete(cart)"
                >
                  <KhtIcon name="trash" />
                </button>
              </td>
            </tr>
          </tbody>
        </AdminTable>
      </div>

      <div class="admin-abandoned-mobile" aria-label="Abandoned carts">
        <article v-for="cart in data.items" :key="cart.id" class="admin-abandoned-card">
          <header>
            <NuxtLink :to="`/admin/abandoned-carts/${cart.id}`">
              <strong>{{ cart.customerName || 'Anonymous cart' }}</strong>
            </NuxtLink>
            <span>{{ money(cart.subtotal) }}</span>
          </header>
          <p>{{ cart.phone || cart.email || 'No contact captured' }}</p>
          <dl>
            <div><dt>Items</dt><dd>{{ cart.itemsCount }}</dd></div>
            <div><dt>Last activity</dt><dd>{{ relative(cart.lastActivity) }}</dd></div>
            <div><dt>Recovery</dt><dd>{{ cart.recoveryState }}</dd></div>
          </dl>
          <time :datetime="cart.createdAt">Created {{ date(cart.createdAt) }}</time>
          <div class="admin-abandoned-card__actions">
            <NuxtLink
              :to="`/admin/abandoned-carts/${cart.id}`"
              class="admin-button admin-button--quiet"
            >
              View cart
            </NuxtLink>
            <button
              type="button"
              class="admin-delete-action"
              :aria-label="`Delete ${cart.customerName || 'anonymous cart'} permanently`"
              :disabled="deleteBusy"
              @click="requestDelete(cart)"
            >
              <KhtIcon name="trash" />
            </button>
          </div>
        </article>
      </div>
    </template>

    <AdminConfirmDialog
      :open="!!pendingDeleteCart"
      title="Delete this abandoned cart?"
      :description="`This permanently removes ${pendingDeleteCart?.customerName || 'this anonymous cart'}, its items, and recovery history. This cannot be undone.`"
      confirm-label="Delete permanently"
      danger
      :busy="deleteBusy"
      @close="closeDeleteDialog"
      @confirm="deleteSelectedCart"
    />
  </div>
</template>
