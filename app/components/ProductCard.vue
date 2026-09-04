<script setup lang="ts">
import type { Product } from '../../shared/types'
defineProps<{ product: Product; index?: number }>()
const { t, money, localized } = useLanguage()
</script>
<template>
  <article class="product-card">
    <NuxtLink
      :to="`/products/${product.slug}`"
      class="product-image-link"
      :aria-label="localized(product.name)"
      ><StoreImage
        :src="product.image"
        :alt="localized(product.name) + ' — ' + t('black with a white line', 'أسود بخط أبيض')"
        loading="lazy"
        width="900"
        height="1200" /><span class="product-code">{{ product.code }}</span
      ><span class="product-image-action"
        ><span>{{ t('Discover piece', 'شوف القطعة') }}</span
        ><KhtIcon name="arrow" /></span
      ><span class="product-hover-line"
    /></NuxtLink>
    <div class="product-meta">
      <div>
        <NuxtLink :to="`/products/${product.slug}`"
          ><h3>{{ localized(product.name) }}</h3></NuxtLink
        ><span>{{ t('Black / White', 'أسود / أبيض') }}</span>
      </div>
      <span class="product-price">{{ money(product.price) }}</span>
    </div>
  </article>
</template>
