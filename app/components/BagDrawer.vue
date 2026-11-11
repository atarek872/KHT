<script setup lang="ts">
import { setSavingsForLines } from '#shared/setOffer'
const { t, money } = useLanguage()
const { open, count, total, lines } = useBag()
const catalog = useCatalog()
const setSaving = computed(() => setSavingsForLines(catalog.value, lines.value))
</script>
<template>
  <OverlayPanel
    :open="open"
    :title="t(`Your bag (${count})`, `سلتك (${count})`)"
    @close="open = false"
  >
    <template v-if="count"
      ><BagItems />
      <div class="bag-summary">
        <div class="summary-row">
          <span>{{ t('Subtotal', 'المجموع الفرعي') }}</span
          ><strong>{{ money(total) }}</strong>
        </div>
        <p v-if="setSaving" class="set-saving">
          {{
            t(
              `You save ${money(setSaving)} with the Full Set.`,
              `وفرت ${money(setSaving)} باختيار الطقم الكامل.`,
            )
          }}
        </p>
        <p class="muted">
          {{ t('Delivery calculated at checkout.', 'تكلفة التوصيل تُحدد عند إتمام الطلب.') }}
        </p>
        <NuxtLink to="/checkout" class="button button-dark" @click="open = false"
          >{{ t('Continue to checkout', 'متابعة لإتمام الطلب') }}<KhtIcon name="arrow" /></NuxtLink
        ><NuxtLink to="/cart" class="button button-outline" @click="open = false">{{
          t('View your bag', 'عرض السلة')
        }}</NuxtLink>
      </div></template
    >
    <div v-else class="empty-state">
      <span class="empty-line" />
      <h3>{{ t('A clean start.', 'بداية جديدة.') }}</h3>
      <p>{{ t('Find a piece that feels like you.', 'اختار القطعة اللي تشبهك.') }}</p>
      <NuxtLink to="/shop" class="button button-dark" @click="open = false"
        >{{ t('Explore the collection', 'اكتشف المجموعة') }}<KhtIcon name="arrow"
      /></NuxtLink>
    </div>
  </OverlayPanel>
</template>
