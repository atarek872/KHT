<script setup lang="ts">
import { setSavingsForLines } from '#shared/setOffer'
const { t, money } = useLanguage()
const { count, total, lines, recover, flush } = useBag()
const catalog = useCatalog()
const route = useRoute()
const recoveryError = ref('')
onMounted(async () => {
  const token = route.hash.match(/^#recovery=([a-f0-9-]{72})$/i)?.[1]
  if (!token) return
  window.history.replaceState(null, '', route.path)
  try {
    const result = await $fetch<{ items: { id: string; size: string; quantity: number }[] }>(
      '/api/cart/recover', { method: 'POST', body: { token } },
    )
    if (!recover(result.items)) throw new Error('Unavailable selections')
    await flush()
  } catch {
    recoveryError.value = t(
      'This bag link is no longer available. Explore the collection to make a fresh selection.',
      'رابط السلة لم يعد متاحًا. تقدر تختار من المجموعة من جديد.',
    )
  }
})
const setSaving = computed(() => setSavingsForLines(catalog.value, lines.value))
useSeoMeta({ title: () => t('Your bag — KHT', 'سلتك — KHT') })
</script>
<template>
  <main id="main" class="commerce-page light-surface">
    <p v-if="recoveryError" class="checkout-guest-note" role="alert">{{ recoveryError }}</p>
    <div class="page-heading">
      <p class="eyebrow">KHT / {{ t('YOUR SELECTION', 'اختياراتك') }}</p>
      <h1>
        {{ t('YOUR BAG.', 'سلتك.') }}<sup>{{ count }}</sup>
      </h1>
    </div>
    <div v-if="count" class="commerce-grid">
      <BagItems />
      <aside class="order-summary">
        <h2>{{ t('A few good pieces.', 'قطع على ذوقك.') }}</h2>
        <div class="summary-row">
          <span>{{ t('Subtotal', 'المجموع الفرعي') }}</span
          ><span>{{ money(total) }}</span>
        </div>
        <p v-if="setSaving" class="set-saving">
          {{
            t(
              `You save ${money(setSaving)} with the Full Set.`,
              `وفرت ${money(setSaving)} باختيار الطقم الكامل.`,
            )
          }}
        </p>
        <div class="summary-row muted">
          <span>{{ t('Delivery', 'التوصيل') }}</span
          ><span>{{ t('At checkout', 'عند إتمام الطلب') }}</span>
        </div>
        <div class="summary-row summary-total">
          <span>{{ t('Subtotal', 'المجموع الفرعي') }}</span
          ><strong>{{ money(total) }}</strong>
        </div>
        <NuxtLink to="/checkout" class="button button-dark"
          >{{ t('Continue to checkout', 'متابعة لإتمام الطلب') }}<KhtIcon name="arrow" /></NuxtLink
        ><NuxtLink to="/shop" class="button button-outline">{{
          t('Continue exploring', 'كمّل تسوق')
        }}</NuxtLink>
        <p class="muted small-copy">
          {{
            t(
              'Cash on delivery only. Delivery is calculated before you place the order.',
              'الدفع عند الاستلام فقط. تكلفة الشحن بتتحسب قبل تسجيل الطلب.',
            )
          }}
        </p>
      </aside>
    </div>
    <div v-else class="empty-state">
      <span class="empty-line" />
      <h2>{{ t('A clean start.', 'بداية جديدة.') }}</h2>
      <p>{{ t('Your next essential is waiting.', 'قطعتك الجاية في انتظارك.') }}</p>
      <NuxtLink to="/shop" class="button button-dark"
        >{{ t('Explore the collection', 'اكتشف المجموعة') }}<KhtIcon name="arrow"
      /></NuxtLink>
    </div>
  </main>
</template>
