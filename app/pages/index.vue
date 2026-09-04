<script setup lang="ts">
const { t, localized } = useLanguage()
const catalog = useCatalog()
useSeoMeta({
  title: 'KHT — Black. White. Line.',
  description: 'Meet Drop 001. Oversized silhouettes. Considered details. A single white line.',
  ogImage: '/images/campaign.png',
})
</script>
<template>
  <main id="main">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-image">
        <StoreImage
          src="/images/campaign.png"
          sizes="(max-width: 767px) 100vw, 72vw"
          :alt="
            t(
              'Two models in black KHT concept streetwear with signature white lines',
              'موديلان بملابس KHT التصورية السوداء وخطوط بيضاء مميزة',
            )
          "
          fetchpriority="high"
          width="1672"
          height="941"
        />
      </div>
      <div class="hero-content">
        <div class="hero-edition">
          <span class="small-line" /><span>{{
            t('DROP 001 / THE ORIGIN', 'الإصدار 001 / البداية')
          }}</span>
        </div>
        <h1 id="hero-title" dir="ltr">BLACK.<br />WHITE.<br />LINE.</h1>
        <div class="hero-signature-line" />
        <p>
          {{ t('Stripped back. Standing apart.', 'تفاصيل أقل. حضور أقوى.') }}<br />{{
            t('A new uniform. A single line.', 'إطلالة جديدة. خط واحد.')
          }}
        </p>
        <NuxtLink to="/drops/001" class="button button-white"
          >{{ t('SHOP DROP 001', 'تسوق الإصدار 001') }}<KhtIcon name="arrow"
        /></NuxtLink>
      </div>
      <span class="hero-image-caption">KHT / STUDY IN CONTRAST</span
      ><a href="#collection" class="hero-scroll"
        >{{ t('Scroll to discover', 'انزل واكتشف') }}<span>↓</span></a
      >
    </section>
    <div class="brand-strip">
      <span>{{ t('A STUDY IN CONTRAST', 'دراسة في التباين') }}</span
      ><span class="brand-strip-center">{{
        t('ONE LINE. NO NOISE.', 'خط واحد. من غير ضوضاء.')
      }}</span
      ><span>{{ t('DESIGNED TO STAND APART', 'تفاصيل تميزك') }}</span>
    </div>
    <section id="collection" class="collection-section light-surface">
      <div class="section-heading">
        <div>
          <p class="eyebrow">{{ t('THE FIRST CHAPTER', 'الفصل الأول') }}</p>
          <h2>{{ t('THE ESSENTIALS.', 'القطع الأساسية.') }}</h2>
        </div>
        <NuxtLink to="/shop" class="text-link"
          >{{ t('Explore the collection', 'اكتشف المجموعة') }}<KhtIcon name="arrow"
        /></NuxtLink>
      </div>
      <div class="product-grid">
        <ProductCard
          v-for="(product, index) in catalog.products"
          :key="product.id"
          :product="product"
          :index="index"
        />
      </div>
      <div class="collection-footnote">
        <span>{{ t('Three silhouettes. One identity.', 'ثلاث قصّات. هوية واحدة.') }}</span
        ><span>001 — 003</span>
      </div>
    </section>
    <section class="manifesto-section">
      <div class="manifesto-top">
        <span>{{ t('THE KHT PHILOSOPHY', 'فلسفة KHT') }}</span>
      </div>
      <div class="manifesto-layout">
        <h2>
          {{ t('NOTHING EXTRA.', 'من غير زيادة.') }}<br /><span>{{
            t('EVERYTHING', 'كل تفصيلة')
          }}</span
          ><br />{{ t('INTENTIONAL.', 'مقصودة.') }}
        </h2>
        <div class="manifesto-copy">
          <span class="long-line" />
          <p>
            {{
              t(
                'We start with black. Add white. Draw a line. What remains is a collection built around shape, movement and the details that matter.',
                'نبدأ بالأسود. نضيف الأبيض. نرسم خط. النتيجة مجموعة تتمحور حول القَصّة والحركة والتفاصيل المهمة.',
              )
            }}
          </p>
          <NuxtLink to="/about" class="text-link"
            >{{ t('The story behind the line', 'الحكاية ورا الخط') }}<KhtIcon name="arrow"
          /></NuxtLink>
        </div>
      </div>
    </section>
    <section class="category-section">
      <div class="section-heading">
        <h2>{{ t('FIND YOUR FORM.', 'اختار إطلالتك.') }}</h2>
        <span>{{ t('EXPLORE BY CATEGORY', 'تصفح حسب النوع') }}</span>
      </div>
      <div class="category-list">
        <NuxtLink
          v-for="(category, index) in catalog.categories"
          :key="category.slug"
          :to="`/categories/${category.slug}`"
          class="category-row"
          ><span class="category-index">0{{ index + 1 }}</span
          ><span class="category-name">{{ localized(category.name) }}</span
          ><span class="category-count"
            >{{ catalog.products.filter((p) => p.category === category.slug).length }}
            {{ t('piece', 'قطعة') }}</span
          ><KhtIcon name="arrow"
        /></NuxtLink>
      </div>
    </section>
    <section class="closing-campaign">
      <span class="closing-line" aria-hidden="true" />
      <div class="closing-copy">
        <span>DROP 001</span>
        <h2>{{ t('FOLLOW', 'اتبع') }}<br />{{ t('THE LINE.', 'الخط.') }}</h2>
        <NuxtLink to="/shop" class="button button-white"
          >{{ t('Find your piece', 'اختار قطعتك') }}<KhtIcon name="arrow"
        /></NuxtLink>
      </div>
    </section>
  </main>
</template>
