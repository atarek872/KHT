<script setup lang="ts">
import { sizePrice } from '#shared/productPricing'
const { t, money, localized } = useLanguage()
const { lines, update, changeSize } = useBag()
const { trackAddToCart } = useStoreAnalytics()
function increase(line: (typeof lines.value)[number]) {
  const limit = Math.min(10, line.product.sizes.find((size) => size.name === line.size)?.stock || 0)
  if (line.quantity >= limit) return
  update(line.id, line.size, line.quantity + 1)
  trackAddToCart(line.product, line.size)
}
</script>
<template>
  <div class="bag-items">
    <article v-for="line in lines" :key="line.id + line.size" class="bag-item">
      <NuxtLink :to="`/products/${line.product.slug}`" class="bag-item-image"
        ><StoreImage
          :src="line.product.image"
          sizes="110px"
          :alt="localized(line.product.name)"
          width="120"
          height="160"
      /></NuxtLink>
      <div class="bag-item-info">
        <NuxtLink :to="`/products/${line.product.slug}`"
          ><h3>{{ localized(line.product.name) }}</h3></NuxtLink
        >
        <p>{{ t('Black / White', 'أسود / أبيض') }}</p>
        <label class="bag-size-select"
          >{{ t('Size', 'المقاس') }}
          <select
            :value="line.size"
            :aria-label="`${localized(line.product.name)} — ${t('Size', 'المقاس')}`"
            @change="changeSize(line.id, line.size, ($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="size in line.product.sizes"
              :key="size.name"
              :value="size.name"
              :disabled="size.stock < 1"
            >
              {{ size.name }}{{ size.stock < 1 ? t(' — unavailable', ' — غير متاح') : '' }}
            </option>
          </select>
        </label>
        <span class="bag-unit-price"
          >{{ t('Each', 'سعر القطعة') }}: {{ money(sizePrice(line.product, line.size)) }}</span
        >
        <strong
          >{{ t('Line total', 'إجمالي القطعة') }}:
          {{ money(sizePrice(line.product, line.size) * line.quantity) }}</strong
        >
        <div class="bag-item-controls">
          <div class="quantity">
            <button
              :aria-label="t('Decrease quantity', 'قلل الكمية')"
              @click="update(line.id, line.size, line.quantity - 1)"
            >
              <KhtIcon name="minus" /></button
            ><span :aria-label="t('Quantity', 'الكمية')">{{ line.quantity }}</span
            ><button
              :disabled="
                line.quantity >=
                Math.min(10, line.product.sizes.find((s) => s.name === line.size)?.stock || 0)
              "
              :aria-label="t('Increase quantity', 'زوّد الكمية')"
              @click="increase(line)"
            >
              <KhtIcon name="plus" />
            </button>
          </div>
          <button class="remove-link" @click="update(line.id, line.size, 0)">
            {{ t('Remove', 'حذف')
            }}<span class="sr-only"> {{ localized(line.product.name) }} {{ line.size }}</span>
          </button>
        </div>
      </div>
    </article>
  </div>
</template>
