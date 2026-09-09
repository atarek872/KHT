<script setup lang="ts">
import { breadcrumbList } from '#shared/storefrontSeo'

const { t } = useLanguage()
const title = computed(() => t('The KHT Story — Black. White. Line.', 'حكاية KHT — أسود. أبيض. خط.'))
const description = computed(() =>
  t(
    'Discover KHT, an Egyptian streetwear label built around considered black silhouettes and one signature white line.',
    'اكتشف KHT، علامة ستريت وير مصرية مبنية على قصّات سوداء مدروسة وخط أبيض مميز.',
  ),
)
useStoreSeo({
  title,
  description,
  path: '/about',
  image: '/images/our-story-cover.png',
  imageAlt: title,
  structuredData: computed(() => ({
    '@context': 'https://schema.org',
    ...breadcrumbList([
      { name: 'KHT', path: '/' },
      { name: t('Our story', 'حكايتنا'), path: '/about' },
    ]),
  })),
})
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
      src="/images/our-story-cover.png"
      :alt="t('KHT — Black. White. Line. brand cover', 'غلاف KHT — أسود. أبيض. خط.')"
      sizes="(max-width: 767px) 100vw, 70vw"
      width="2659"
      height="984"
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
