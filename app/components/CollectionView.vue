<script setup lang="ts">
import { matchesProduct } from '../utils/productSearch'
const props = defineProps<{ category?: string; drop?: boolean; search?: boolean }>()
const { t, localized } = useLanguage()
const catalog = useCatalog()
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
if (props.category && !categoryData.value)
  throw createError({ statusCode: 404, statusMessage: 'Collection not found' })
const title = computed(() =>
  props.search
    ? t('FIND YOUR PIECE.', 'اختار قطعتك.')
    : categoryData.value
      ? localized(categoryData.value.name)
      : props.drop
        ? 'DROP 001.'
        : t('THE COLLECTION.', 'المجموعة.'),
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
useSeoMeta({ title: () => `${title.value} — KHT` })
</script>
<template>
  <main id="main" class="light-surface collection-page">
    <header class="collection-page-heading">
      <NuxtLink to="/" class="breadcrumb">{{ t('Home', 'الرئيسية') }}</NuxtLink>
      <div class="section-heading">
        <div>
          <p class="eyebrow">
            {{
              drop
                ? t('THE ORIGIN / CONCEPT COLLECTION', 'البداية / مجموعة تصورية')
                : 'KHT / DROP 001'
            }}
          </p>
          <h1>{{ title }}</h1>
        </div>
        <p>{{ t('Black. White. A line that makes it yours.', 'أسود. أبيض. خط يشبهك.') }}</p>
      </div>
    </header>
    <div v-if="drop" class="drop-banner">
      <StoreImage
        src="/images/tracksuit.png"
        :alt="t('The Line Tracksuit, front view', 'سوت ذا لاين، صورة أمامية')"
        sizes="(max-width: 767px) 45vw, 38vw"
        width="1086"
        height="1448"
      /><span>{{ t('THE FIRST CHAPTER.', 'الفصل الأول.') }}</span>
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
          'Concept garments and sample prices. Explore the fit, the form, the line.',
          'قطع تصورية وأسعار تجريبية. اكتشف القَصّة والشكل والخط.',
        )
      }}
    </p>
  </main>
</template>
