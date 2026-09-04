<script setup lang="ts">
const { t } = useLanguage()
useSeoMeta({ title: 'The story behind the line — KHT' })
</script>
<template>
  <main id="main" class="about-page">
    <section class="about-intro">
      <p class="eyebrow">KHT / {{ t('OUR STORY', 'حكايتنا') }}</p>
      <h1>{{ t('IT STARTS', 'البداية') }}<br />{{ t('WITH A LINE.', 'خط.') }}</h1>
      <span class="about-line" />
      <div class="about-copy">
        <p>
          {{
            t(
              'Black gives it shape. White gives it definition. The line gives it an identity.',
              'الأسود يرسم الشكل. الأبيض يوضح التفاصيل. والخط يديها هوية.',
            )
          }}
        </p>
        <p>
          {{
            t(
              'KHT is a study in doing less, with intention. A wardrobe of considered silhouettes connected by a single detail. Across a tee, a tracksuit and a pair of trousers, the line stays the same. The way you wear it is yours.',
              'KHT دراسة في البساطة المقصودة. قصّات مدروسة يجمعها تفصيل واحد. من التيشرت للسوت للبنطلون، الخط ثابت. وطريقتك في اللبس تخصك.',
            )
          }}
        </p>
      </div>
    </section>
    <StoreImage
      class="about-campaign"
      src="/images/tee.png"
      :alt="
        t('The white chest line on the KHT concept tee', 'الخط الأبيض على صدر تيشرت KHT التصوري')
      "
      sizes="(max-width: 767px) 100vw, 70vw"
      width="1086"
      height="1448"
      loading="lazy"
    />
    <section class="about-ending">
      <span>BLACK. WHITE. LINE.</span
      ><NuxtLink to="/shop" class="button button-white"
        >{{ t('Explore the first chapter', 'اكتشف الفصل الأول') }}<KhtIcon name="arrow"
      /></NuxtLink>
    </section>
  </main>
</template>
