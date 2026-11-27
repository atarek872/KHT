<script setup lang="ts">
import { activeStorePromotion, type StorePromotion } from '#shared/promotion'

const props = defineProps<{ promotion: StorePromotion; language: 'en' | 'ar' }>()
const active = computed(() => activeStorePromotion(props.promotion).announcement)
const message = computed(() => props.promotion.announcementMessage[props.language])
const destination = computed(() => {
  const path = props.promotion.announcementLink || '/cart'
  if (!props.promotion.announcementCode || !path.startsWith('/cart')) return path
  return { path: '/cart', query: { coupon: props.promotion.announcementCode } }
})
</script>

<template>
  <div v-if="active" class="store-promotion-bar">
    <NuxtLink :to="destination" class="store-promotion-bar__link">
      <span class="store-promotion-bar__spark" aria-hidden="true">✦</span>
      <span class="store-promotion-bar__message">{{ message }}</span>
      <span v-if="promotion.announcementCode" class="store-promotion-bar__code">{{
        promotion.announcementCode
      }}</span>
      <KhtIcon name="arrow" />
    </NuxtLink>
  </div>
</template>
