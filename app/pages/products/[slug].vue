<script setup lang="ts">
const route = useRoute()
const { t, localized, money } = useLanguage()
const catalog = useCatalog()
const product = computed(() => catalog.value.products.find((p) => p.slug === route.params.slug))
if (!product.value) throw createError({ statusCode: 404, statusMessage: 'Piece not found' })
const category = computed(() =>
  catalog.value.categories.find((c) => c.slug === product.value?.category),
)
const selectedSize = ref('')
const message = ref('')
const zoom = ref(false)
const actualSize = ref(true)
const sizeGuide = ref(false)
const buying = ref(false)
function selectSize(size: string) {
  selectedSize.value = size
  message.value = ''
}
const bag = useBag()
const sizesElement = ref<HTMLElement>()
const buyElement = ref<HTMLElement>()
const stickyVisible = ref(false)
let observer: IntersectionObserver | undefined
onMounted(() => {
  observer = new IntersectionObserver(([entry]) => {
    stickyVisible.value = !!entry && !entry.isIntersecting && entry.boundingClientRect.top < 0
  })
  if (buyElement.value) observer.observe(buyElement.value)
})
onBeforeUnmount(() => observer?.disconnect())
watch(
  () => route.params.slug,
  () => {
    selectedSize.value = ''
    message.value = ''
  },
)
async function addToBag() {
  if (!selectedSize.value) {
    sizesElement.value?.scrollIntoView({ behavior: 'auto', block: 'center' })
    sizesElement.value?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    return
  }
  if (!product.value || buying.value) return
  buying.value = true
  message.value = ''
  if (!bag.add(product.value, selectedSize.value))
    message.value = t(
      'The available quantity is already in your bag, or your bag is full.',
      'الكمية المتاحة موجودة بالفعل في سلتك، أو السلة ممتلئة.',
    )
  buying.value = false
}
useSeoMeta({
  title: () => `${product.value ? localized(product.value.name) : 'Product'} — KHT`,
  description: () => (product.value ? localized(product.value.description) : ''),
  ogImage: () => product.value?.image,
})
</script>
<template>
  <main v-if="product" id="main" class="product-page light-surface">
    <nav class="breadcrumbs">
      <NuxtLink to="/shop">{{ t('Collection', 'المجموعة') }}</NuxtLink
      ><span>/</span
      ><NuxtLink :to="`/categories/${product.category}`">{{
        category ? localized(category.name) : ''
      }}</NuxtLink
      ><span>/</span><span>{{ localized(product.name) }}</span>
    </nav>
    <div class="product-detail-grid">
      <div class="product-gallery">
        <button
          class="product-main-image"
          :aria-label="t('Enlarge product image', 'كبّر صورة المنتج')"
          @click="zoom = true"
        >
          <StoreImage
            :src="product.image"
            sizes="(max-width: 767px) 100vw, 55vw"
            :alt="localized(product.name)"
            width="1086"
            height="1448"
            fetchpriority="high"
          /><span class="zoom-label"
            >{{ t('Explore the details', 'شوف التفاصيل') }}<KhtIcon name="plus" /></span
          ><span class="product-code">{{ product.code }}</span></button
        ><span class="image-note">{{
          t('Concept image / Front view', 'صورة تصورية / أمامية')
        }}</span>
      </div>
      <div class="product-details">
        <p class="eyebrow">DROP 001 / {{ product.code }}</p>
        <h1>{{ localized(product.name) }}</h1>
        <p class="detail-price">{{ money(product.price) }}</p>
        <p class="product-description">{{ localized(product.description) }}</p>
        <div class="color-choice">
          <span class="color-swatch" /><span>{{ t('Black / White', 'أسود / أبيض') }}</span>
        </div>
        <div ref="sizesElement" class="size-section">
          <div class="size-heading">
            <span
              >{{ t('Select size', 'اختار مقاسك')
              }}<b v-if="selectedSize"> / {{ selectedSize }}</b></span
            ><button class="remove-link" @click="sizeGuide = true">
              {{ t('Size guide', 'دليل المقاسات') }}
            </button>
          </div>
          <div class="size-options" role="group" :aria-label="t('Size', 'المقاس')">
            <button
              v-for="size in product.sizes"
              :key="size.name"
              :class="{ selected: selectedSize === size.name }"
              :disabled="size.stock === 0"
              :aria-pressed="selectedSize === size.name"
              :aria-label="size.name + (size.stock === 0 ? t(' — unavailable', ' — غير متاح') : '')"
              @click="selectSize(size.name)"
            >
              {{ size.name }}
            </button>
          </div>
          <p class="size-hint">
            {{
              selectedSize
                ? t('Selected size is available.', 'المقاس المختار متاح.')
                : t(
                    'Choose a size to add this piece to your bag.',
                    'اختار مقاس عشان تضيف القطعة للسلة.',
                  )
            }}
          </p>
        </div>
        <div ref="buyElement">
          <button
            class="button button-dark add-button"
            :disabled="!selectedSize || buying"
            @click="addToBag"
          >
            {{ buying ? t('Adding…', 'جارٍ الإضافة…') : t('Add to bag', 'أضف للسلة')
            }}<KhtIcon name="arrow" />
          </button>
        </div>
        <p v-if="message" class="form-error" role="alert">{{ message }}</p>
        <div class="product-service-links">
          <NuxtLink to="/shipping">{{ t('Delivery information', 'معلومات التوصيل') }}</NuxtLink
          ><NuxtLink to="/returns">{{ t('Returns & exchanges', 'الاستبدال والاسترجاع') }}</NuxtLink>
        </div>
        <details class="detail-accordion" open>
          <summary>{{ t('The fit', 'القَصّة') }}<span>+</span></summary>
          <p>{{ localized(product.fit) }}</p>
        </details>
        <details class="detail-accordion">
          <summary>{{ t('Details & care', 'التفاصيل والعناية') }}<span>+</span></summary>
          <p>{{ localized(product.detail) }}</p>
        </details>
        <p class="product-demo-note">
          {{
            t(
              'Concept piece. Sample price. Checkout is a demonstration; no payment will be taken.',
              'قطعة تصورية بسعر تجريبي. إتمام الطلب للتجربة فقط؛ لا يتم تحصيل مبلغ.',
            )
          }}
        </p>
      </div>
    </div>
    <section class="related-section">
      <div class="section-heading">
        <h2>{{ t('SAME LINE. NEW FORM.', 'نفس الخط. شكل جديد.') }}</h2>
        <NuxtLink to="/shop" class="text-link"
          >{{ t('All pieces', 'كل القطع') }}<KhtIcon name="arrow"
        /></NuxtLink>
      </div>
      <div class="product-grid related-grid">
        <ProductCard
          v-for="item in catalog.products.filter((p) => p.id !== product!.id)"
          :key="item.id"
          :product="item"
        />
      </div>
    </section>
    <div v-if="stickyVisible" class="mobile-buy-bar">
      <span>{{ money(product.price) }}</span
      ><button class="button button-dark" @click="addToBag">
        {{ selectedSize ? t('Add to bag', 'أضف للسلة') : t('Select size', 'اختار مقاسك')
        }}<KhtIcon name="arrow" />
      </button>
    </div>
    <OverlayPanel
      :open="sizeGuide"
      :title="t('Finding your fit', 'اختار المقاس المناسب')"
      @close="sizeGuide = false"
      ><SizeGuideContent
    /></OverlayPanel>
    <OverlayPanel :open="zoom" :title="localized(product.name)" wide @close="zoom = false"
      ><div class="zoom-toolbar">
        <p>{{ t('Scroll to explore the details.', 'مرّر الصورة لاستكشاف التفاصيل.') }}</p>
        <button class="remove-link" :aria-pressed="!actualSize" @click="actualSize = !actualSize">
          {{ actualSize ? t('Fit image', 'اعرض الصورة كاملة') : t('Actual size', 'الحجم الأصلي') }}
        </button>
      </div>
      <div
        class="zoom-viewport"
        :class="{ 'zoom-fit': !actualSize }"
        tabindex="0"
        role="region"
        :aria-label="t('Product image, scroll to explore', 'صورة المنتج، مرّر لاستكشافها')"
      >
        <StoreImage
          :src="product.image"
          sizes="1086px"
          :alt="localized(product.name)"
          class="zoomed-product"
          width="1086"
          height="1448"
        />
      </div>
      <p class="muted">
        {{ t('Concept garment. Front view.', 'قطعة تصورية. صورة أمامية.') }}
      </p></OverlayPanel
    >
  </main>
</template>
