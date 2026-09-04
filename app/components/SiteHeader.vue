<script setup lang="ts">
const { t, locale, localized } = useLanguage()
const catalog = useCatalog()
const bag = useBag()
const menu = ref(false)
const search = ref(false)
const query = ref('')
const route = useRoute()
watch(
  () => route.fullPath,
  () => {
    menu.value = false
    search.value = false
    bag.open.value = false
  },
)
function submitSearch() {
  if (query.value.trim()) navigateTo({ path: '/search', query: { q: query.value.trim() } })
}
</script>
<template>
  <div class="announcement">
    <span>{{ t('DROP 001 — THE FIRST CHAPTER', 'الإصدار 001 — الفصل الأول') }}</span
    ><span class="announcement-secondary">{{ t('BLACK. WHITE. LINE.', 'أسود. أبيض. خط.') }}</span
    ><span>{{ t('CONCEPT COLLECTION', 'مجموعة تصورية') }}</span>
  </div>
  <header class="site-header">
    <NuxtLink to="/" class="wordmark" aria-label="KHT home">KHT<span class="logo-line" /></NuxtLink>
    <nav class="desktop-nav" :aria-label="t('Main navigation', 'التنقل الرئيسي')">
      <NuxtLink to="/shop">{{ t('Shop all', 'كل المنتجات') }}</NuxtLink>
      <NuxtLink to="/drops/001">Drop 001<span class="nav-dot" /></NuxtLink>
      <NuxtLink to="/about">{{ t('Our story', 'عن KHT') }}</NuxtLink>
    </nav>
    <div class="header-actions">
      <button
        class="language-button"
        :aria-label="t('Switch to Arabic', 'Switch to English')"
        @click="locale = locale === 'en' ? 'ar' : 'en'"
      >
        {{ t('عربي', 'EN') }}
      </button>
      <button
        class="icon-button"
        :aria-label="t('Search products', 'ابحث عن منتج')"
        @click="search = true"
      >
        <KhtIcon name="search" />
      </button>
      <button
        class="bag-button"
        :aria-label="
          t(`Shopping bag, ${bag.count.value} items`, `سلة التسوق، ${bag.count.value} قطع`)
        "
        @click="bag.open.value = true"
      >
        <KhtIcon name="bag" /><span class="bag-text">{{ t('Bag', 'السلة') }}</span
        ><span class="bag-count" aria-live="polite">({{ bag.count.value }})</span>
      </button>
      <button
        class="icon-button mobile-menu-button"
        :aria-label="t('Open menu', 'افتح القائمة')"
        @click="menu = true"
      >
        <KhtIcon name="menu" />
      </button>
    </div>
  </header>
  <OverlayPanel
    :open="menu"
    :title="t('Explore KHT', 'اكتشف KHT')"
    side="start"
    @close="menu = false"
  >
    <nav class="mobile-nav">
      <NuxtLink to="/shop">{{ t('Shop all', 'كل المنتجات') }}</NuxtLink
      ><NuxtLink
        v-for="category in catalog.categories"
        :key="category.slug"
        :to="`/categories/${category.slug}`"
        >{{ localized(category.name) }}</NuxtLink
      ><NuxtLink to="/drops/001">Drop 001</NuxtLink
      ><NuxtLink to="/about">{{ t('Our story', 'عن KHT') }}</NuxtLink>
    </nav>
    <div class="panel-bottom">
      <NuxtLink to="/size-guide">{{ t('Size guide', 'دليل المقاسات') }}</NuxtLink
      ><NuxtLink to="/shipping">{{ t('Shipping & returns', 'الشحن والاسترجاع') }}</NuxtLink>
    </div>
  </OverlayPanel>
  <OverlayPanel :open="search" :title="t('Find your piece', 'اختار قطعتك')" @close="search = false">
    <form class="search-form" @submit.prevent="submitSearch">
      <label for="site-search">{{ t('Search the collection', 'ابحث في المجموعة') }}</label>
      <div class="search-input">
        <input
          id="site-search"
          v-model="query"
          type="search"
          :placeholder="t('T-shirt, tracksuit, trousers…', 'تيشرت، سوت، بنطلون…')"
          required
        /><button class="icon-button" :aria-label="t('Search', 'ابحث')">
          <KhtIcon name="arrow" />
        </button>
      </div>
    </form>
    <p class="muted">{{ t('Explore by category', 'تصفح حسب النوع') }}</p>
    <div class="search-categories">
      <NuxtLink
        v-for="category in catalog.categories"
        :key="category.slug"
        :to="`/categories/${category.slug}`"
        >{{ localized(category.name) }}<KhtIcon name="arrow"
      /></NuxtLink>
    </div>
  </OverlayPanel>
</template>
