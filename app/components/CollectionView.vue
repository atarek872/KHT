<script setup lang="ts">
import { matchesProduct } from '../utils/productSearch'
import { breadcrumbList } from '#shared/storefrontSeo'
const props = defineProps<{ category?: string; drop?: boolean; search?: boolean }>()
const { t, localized } = useLanguage()
const catalog = useCatalog()
const storeContent = useStoreContent()
const route = useRoute()
const router = useRouter()
const size = computed({
  get: () => String(route.query.size || ''),
  set: (value) => updateQuery('size', value),
})
const sort = computed({
  get: () => String(route.query.sort || 'featured'),
  set: (value) => updateQuery('sort', value),
})
const searchText = ref(String(route.query.q || ''))
watch(
  () => route.query.q,
  (value) => {
    searchText.value = String(value || '')
  },
)
function updateQuery(key: string, value: string) {
  router.replace({ query: { ...route.query, [key]: value || undefined } })
}
const categoryData = computed(() => catalog.value.categories.find((c) => c.slug === props.category))
const pageKey = computed(() => (props.drop ? 'drop' : props.category ? 'category' : 'shop'))
const page = computed(() => storeContent.value.pages[pageKey.value])
const dropBanner = computed(() =>
  page.value.sections.find((section) => section.id === 'feature-banner'),
)
if (props.category && !categoryData.value)
  throw createError({ statusCode: 404, statusMessage: 'Collection not found' })
const title = computed(() =>
  props.search
    ? t('FIND YOUR PIECE.', 'اختار قطعتك.')
    : categoryData.value
      ? localized(categoryData.value.name)
      : props.drop
        ? t(page.value.hero.title.en, page.value.hero.title.ar)
        : t(page.value.hero.title.en, page.value.hero.title.ar),
)
const products = computed(() => {
  const query = props.search
    ? String(route.query.q || '')
        .toLowerCase()
        .trim()
    : ''
  const list = catalog.value.products.filter(
    (p) =>
      (!props.category || p.category === props.category) &&
      (!size.value || p.sizes.some((s) => s.name === size.value && s.stock > 0)) &&
      matchesProduct(p, query, catalog.value.categories),
  )
  return sort.value === 'price-low'
    ? list.sort((a, b) => a.price - b.price)
    : sort.value === 'price-high'
      ? list.sort((a, b) => b.price - a.price)
      : list
})
const canonicalPath = computed(() =>
  props.category
    ? `/categories/${props.category}`
    : props.drop
      ? '/drops/001'
      : props.search
        ? '/search'
        : '/shop',
)
const seoTitle = computed(() =>
  props.category
    ? `${title.value} from Drop 001 — KHT Egypt`
    : props.drop
      ? t(page.value.seo.title.en, page.value.seo.title.ar)
      : props.search
        ? t('Search the KHT collection', 'ابحث في مجموعة KHT')
        : t(page.value.seo.title.en, page.value.seo.title.ar),
)
const seoDescription = computed(() =>
  props.category
    ? t(
        `Shop ${title.value} from KHT Drop 001. Oversized black silhouettes finished with the signature white line. Cash on delivery in Egypt.`,
        `تسوق ${title.value} من إصدار KHT 001. قصّات سوداء أوفر سايز بخط KHT الأبيض المميز، والدفع عند الاستلام في مصر.`,
      )
    : props.drop
      ? t(page.value.seo.description.en, page.value.seo.description.ar)
      : t(page.value.seo.description.en, page.value.seo.description.ar),
)
const seoImage = computed(
  () =>
    page.value.seo.socialImageUrl ||
    categoryData.value?.image ||
    page.value.hero.imageUrl ||
    '/images/campaign.png',
)
const structuredData = computed(() => ({
  '@context': 'https://schema.org',
  ...breadcrumbList(
    props.category
      ? [
          { name: 'KHT', path: '/' },
          { name: t('Collection', 'المجموعة'), path: '/shop' },
          { name: title.value, path: canonicalPath.value },
        ]
      : [
          { name: 'KHT', path: '/' },
          { name: title.value, path: canonicalPath.value },
        ],
  ),
}))
useStoreSeo({
  title: seoTitle,
  description: seoDescription,
  path: canonicalPath,
  image: seoImage,
  imageAlt: title,
  structuredData,
})
</script>
<template>
  <main id="main" class="light-surface collection-page">
    <ContentPageHero v-if="page.hero.enabled && !drop" :page="page" />
    <header v-if="!page.hero.enabled || drop" class="collection-page-heading">
      <NuxtLink to="/" class="breadcrumb">{{ t('Home', 'الرئيسية') }}</NuxtLink>
      <div class="section-heading">
        <div>
          <p class="eyebrow">
            {{ t(page.hero.eyebrow.en, page.hero.eyebrow.ar) }}
          </p>
          <h1>{{ title }}</h1>
        </div>
        <p>{{ t(page.hero.body.en, page.hero.body.ar) }}</p>
      </div>
    </header>
    <div v-if="drop" class="drop-banner">
      <picture>
        <source
          v-if="page.hero.mobileImageUrl"
          media="(max-width: 767px)"
          :srcset="page.hero.mobileImageUrl"
        />
        <StoreImage
          :src="page.hero.imageUrl || '/images/drop-001-banner.jpg'"
          :alt="t(page.hero.imageAlt.en, page.hero.imageAlt.ar)"
          sizes="(max-width: 767px) 45vw, 38vw"
          width="1024"
          height="1280"
        />
      </picture>
      <span>{{
        t(dropBanner?.heading.en || 'THE FIRST CHAPTER.', dropBanner?.heading.ar || 'الفصل الأول.')
      }}</span>
    </div>
    <form v-if="search" class="collection-search" @submit.prevent="updateQuery('q', searchText)">
      <label for="collection-query" class="sr-only">{{
        t('Search products', 'ابحث عن منتجات')
      }}</label
      ><input
        id="collection-query"
        v-model="searchText"
        type="search"
        :placeholder="t('Search the collection…', 'ابحث في المجموعة…')"
      /><button class="button button-dark">
        {{ t('Search', 'ابحث') }}<KhtIcon name="search" />
      </button>
    </form>
    <div class="collection-toolbar">
      <nav class="category-tabs" :aria-label="t('Categories', 'التصنيفات')">
        <NuxtLink to="/shop" :class="{ selected: !category && !search }">{{
          t('All pieces', 'كل القطع')
        }}</NuxtLink
        ><NuxtLink
          v-for="cat in catalog.categories"
          :key="cat.slug"
          :to="`/categories/${cat.slug}`"
          :class="{ selected: category === cat.slug }"
          >{{ localized(cat.name) }}</NuxtLink
        >
      </nav>
      <div class="collection-filters">
        <label
          ><span>{{ t('Size', 'المقاس') }}</span
          ><select v-model="size">
            <option value="">{{ t('All', 'الكل') }}</option>
            <option v-for="s in ['S', 'M', 'L', 'XL', 'XXL']" :key="s">{{ s }}</option>
          </select></label
        ><label
          ><span class="sr-only">{{ t('Sort by', 'ترتيب حسب') }}</span
          ><select v-model="sort">
            <option value="featured">{{ t('Featured', 'المختارات') }}</option>
            <option value="price-low">{{ t('Price: low to high', 'السعر: الأقل أولًا') }}</option>
            <option value="price-high">{{ t('Price: high to low', 'السعر: الأعلى أولًا') }}</option>
          </select></label
        >
      </div>
    </div>
    <div class="results-summary" aria-live="polite">
      <span
        >{{ products.length }} {{ t('pieces', 'قطع')
        }}<span v-if="search && route.query.q"> — “{{ route.query.q }}”</span></span
      ><button v-if="size" class="remove-link" @click="size = ''">
        {{ t('Clear size filter', 'مسح فلتر المقاس') }} ×
      </button>
    </div>
    <div v-if="products.length" class="product-grid">
      <ProductCard v-for="product in products" :key="product.id" :product="product" />
    </div>
    <div v-else class="empty-state">
      <span class="empty-line" />
      <h2>{{ t('No pieces found.', 'مفيش منتجات مطابقة.') }}</h2>
      <p>
        {{
          t(
            'Try another search or clear your size filter.',
            'جرّب كلمة مختلفة أو امسح فلتر المقاس.',
          )
        }}
      </p>
      <NuxtLink to="/shop" class="button button-dark"
        >{{ t('View all pieces', 'شوف كل القطع') }}<KhtIcon name="arrow"
      /></NuxtLink>
    </div>
    <p class="catalog-note">
      {{
        t(
          'Considered essentials with a clear fit, form, and line.',
          'قطع أساسية مدروسة بقَصّة وشكل وخط واضح.',
        )
      }}
    </p>
  </main>
</template>
