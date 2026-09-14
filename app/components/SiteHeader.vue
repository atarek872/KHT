<script setup lang="ts">
const { t, locale, localized } = useLanguage()
const storeContent = useStoreContent()
const brand = computed(() => storeContent.value.brand)
const navigation = computed(() => storeContent.value.navigation.filter((item) => item.enabled))
const desktopNavigation = computed(() => navigation.value.filter((item) => item.desktop))
const mobileMainNavigation = computed(() =>
  navigation.value.filter((item) => item.mobile && item.mobileSection === 'main'),
)
const mobileBottomNavigation = computed(() =>
  navigation.value.filter((item) => item.mobile && item.mobileSection === 'bottom'),
)
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
    <span>{{ t(brand.announcementStart.en, brand.announcementStart.ar) }}</span
    ><span class="announcement-secondary">{{
      t(brand.announcementCenter.en, brand.announcementCenter.ar)
    }}</span
    ><span>{{ t(brand.announcementEnd.en, brand.announcementEnd.ar) }}</span>
  </div>
  <header class="site-header">
    <NuxtLink to="/" class="wordmark" :aria-label="`${brand.name} home`">
      <img v-if="brand.logoUrl" :src="brand.logoUrl" :alt="brand.name" />
      <template v-else>{{ brand.name }}<span class="logo-line" /></template>
    </NuxtLink>
    <nav class="desktop-nav" :aria-label="t('Main navigation', 'التنقل الرئيسي')">
      <NuxtLink v-for="item in desktopNavigation" :key="item.id" :to="item.href">
        {{ t(item.label.en, item.label.ar) }}<span v-if="item.id === 'drop-001'" class="nav-dot" />
      </NuxtLink>
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
      <NuxtLink to="/account" class="icon-button" :aria-label="t('Your account', 'حسابك')"
        ><KhtIcon name="user"
      /></NuxtLink>
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
      <NuxtLink v-for="item in mobileMainNavigation" :key="item.id" :to="item.href">{{
        t(item.label.en, item.label.ar)
      }}</NuxtLink
      ><NuxtLink
        v-for="category in catalog.categories"
        :key="category.slug"
        :to="`/categories/${category.slug}`"
        >{{ localized(category.name) }}</NuxtLink
      ><NuxtLink to="/account">{{ t('Your account', 'حسابك') }}</NuxtLink>
    </nav>
    <div class="panel-bottom">
      <NuxtLink v-for="item in mobileBottomNavigation" :key="item.id" :to="item.href">{{
        t(item.label.en, item.label.ar)
      }}</NuxtLink>
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
