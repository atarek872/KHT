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
          {{
            t(
              'See delivery and your final total in your bag.',
              'شوف الشحن والإجمالي النهائي في السلة.',
            )
          }}
        </p>
        <NuxtLink to="/cart" class="button button-dark" @click="open = false">
          {{ t('See total & checkout', 'شوف الإجمالي وكمل الطلب') }}<KhtIcon name="arrow" />
        </NuxtLink></div
    ></template>
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
