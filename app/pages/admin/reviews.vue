<script setup lang="ts">
import type { AdminProductReview } from '../../../shared/productReview'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Reviews — KHT Admin', robots: 'noindex, nofollow' })
const { data, error, refresh } = await useFetch<AdminProductReview[]>('/api/admin/reviews')
const busy = ref('')
const feedback = ref('')
async function moderate(review: AdminProductReview, status: 'approved' | 'rejected') {
  if (busy.value) return
  busy.value = review.id
  feedback.value = ''
  try {
    await $fetch(`/api/admin/reviews/${encodeURIComponent(review.id)}`, {
      method: 'PATCH',
      body: { status },
    })
    await refresh()
    feedback.value = status === 'approved' ? 'Review published.' : 'Review hidden.'
  } catch {
    feedback.value = 'Could not update the review. Refresh and try again.'
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <div class="admin-shell__page admin-reviews-page">
    <AdminPageHeader
      eyebrow="Customer voice"
      title="Product reviews"
      description="Only delivered orders can submit reviews. Approve genuine feedback before it appears on the store."
    />
    <p v-if="feedback" role="status" class="admin-state-notice">{{ feedback }}</p>
    <AdminEmptyState v-if="error" title="Reviews unavailable" description="Could not load reviews.">
      <template #actions><AdminButton @click="refresh()">Retry</AdminButton></template>
    </AdminEmptyState>
    <AdminEmptyState
      v-else-if="!data?.length"
      title="No reviews yet"
      description="Verified buyers can submit a review from a product page after delivery."
    />
    <div v-else class="admin-review-list">
      <article v-for="review in data" :key="review.id" class="admin-review-card">
        <div class="admin-review-card__top">
          <div>
            <strong>{{ review.productName }}</strong
            ><span>{{ review.orderNumber || 'Order removed' }} · {{ review.displayName }}</span>
          </div>
          <span>{{ review.status }}</span>
        </div>
        <p :aria-label="`${review.rating} out of 5 stars`" class="review-stars">
          {{ '★'.repeat(review.rating) }}{{ '☆'.repeat(5 - review.rating) }}
        </p>
        <p>{{ review.body }}</p>
        <div class="admin-review-card__actions">
          <AdminButton
            variant="secondary"
            :disabled="busy === review.id || review.status === 'approved'"
            @click="moderate(review, 'approved')"
            >Approve</AdminButton
          >
          <AdminButton
            variant="quiet"
            :disabled="busy === review.id || review.status === 'rejected'"
            @click="moderate(review, 'rejected')"
            >Hide</AdminButton
          >
        </div>
      </article>
    </div>
  </div>
</template>
