<script setup lang="ts">
import { getDiscountPercentage } from '#shared/productPricing'

const props = withDefaults(defineProps<{
  price: number
  compareAtPrice?: number | null
  compact?: boolean
  from?: boolean
}>(), {
  compareAtPrice: null,
  compact: false,
  from: false,
})
const { t, money } = useLanguage()
const discount = computed(() => getDiscountPercentage(props.price, props.compareAtPrice))
</script>

<template>
  <span class="product-price-display" :class="{ 'product-price-display--compact': compact }">
    <del v-if="discount !== null && compareAtPrice !== null" class="product-price-display__previous">
      {{ money(compareAtPrice) }}
    </del>
    <span class="product-price-display__current">{{ from ? t('From', 'يبدأ من') + ' ' : '' }}{{ money(price) }}</span>
    <span v-if="discount !== null" class="product-price-display__discount">
      {{ t(`${discount}% OFF`, `خصم ${discount}٪`) }}
    </span>
  </span>
</template>
