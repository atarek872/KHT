<script setup lang="ts">
import { khtWhatsAppLink } from '#shared/whatsapp'

const route = useRoute()
const catalog = useCatalog()
const { t, localized } = useLanguage()
const selectedSize = useState('kht-whatsapp-product-size', () => '')
const dismissed = ref(false)
onMounted(() => {
  dismissed.value = sessionStorage.getItem('kht-whatsapp-dismissed') === '1'
})
function dismiss() {
  dismissed.value = true
  sessionStorage.setItem('kht-whatsapp-dismissed', '1')
}
const product = computed(() =>
  route.path.startsWith('/products/')
    ? catalog.value.products.find((item) => item.slug === route.params.slug)
    : undefined,
)
const href = computed(() =>
  khtWhatsAppLink(
    product.value
      ? t(
          `Hello KHT, I have a question about ${localized(product.value.name)}. Size: ${selectedSize.value || 'not selected yet'}.`,
          `أهلاً KHT، عندي استفسار عن ${localized(product.value.name)}. المقاس: ${selectedSize.value || 'لسه ما اخترتش'}.`,
        )
      : t('Hello KHT, I need help with an order.', 'أهلاً KHT، محتاج مساعدة في طلب.'),
  ),
)
</script>

<template>
  <Transition name="store-whatsapp-dismiss">
    <div
      v-if="!dismissed"
      class="store-whatsapp-wrap"
      :class="{ 'store-whatsapp-wrap--product': product }"
    >
      <a
        class="store-whatsapp"
        :href="href"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="t('Ask KHT on WhatsApp', 'اسأل KHT على واتساب')"
        title="WhatsApp"
      >
        <KhtIcon name="whatsapp" />
      </a>
      <button
        type="button"
        class="store-whatsapp-close"
        :aria-label="t('Hide WhatsApp shortcut', 'إخفاء زر واتساب')"
        @click="dismiss"
      >
        <KhtIcon name="close" />
      </button>
    </div>
  </Transition>
</template>
