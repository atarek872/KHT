<script setup lang="ts">
const { t, money } = useLanguage()
const { count, total } = useBag()
useSeoMeta({ title: () => t('Your bag — KHT', 'سلتك — KHT') })
</script>
<template>
  <main id="main" class="commerce-page light-surface">
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
              'This is a concept storefront. No payment will be taken.',
              'دي نسخة تصورية من المتجر. لا يتم تحصيل أي مبلغ.',
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
