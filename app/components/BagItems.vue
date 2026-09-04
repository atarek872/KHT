<script setup lang="ts">
const { t, money, localized } = useLanguage()
const { lines, update } = useBag()
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
        <p>{{ t('Black / White', 'أسود / أبيض') }} · {{ t('Size', 'مقاس') }} {{ line.size }}</p>
        <span>{{ money(line.product.price * line.quantity) }}</span>
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
              @click="update(line.id, line.size, line.quantity + 1)"
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
