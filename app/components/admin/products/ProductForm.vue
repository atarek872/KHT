<script setup lang="ts">
import type { AdminProductInput } from '../../../../shared/adminProduct'
import type { AdminCategory } from '../../../../shared/adminCategory'

const props = defineProps<{ initial?: AdminProductInput; busy?: boolean; error?: string }>()
const emit = defineEmits<{ submit: [value: AdminProductInput] }>()
const clone = (value: AdminProductInput) => JSON.parse(JSON.stringify(value)) as AdminProductInput
const uploading = ref(false)
const uploadError = ref('')
const { data: categories } = await useFetch<AdminCategory[]>('/api/admin/categories')
const initialImage = props.initial?.image || ''
const emptyProduct: AdminProductInput = {
  slug: '', code: '', category: 'tees', price: 0, compareAtPrice: null, image: '', images: [], active: true,
  name: { en: '', ar: '' }, description: { en: '', ar: '' }, detail: { en: '', ar: '' },
  fit: { en: '', ar: '' }, variants: [],
}
const form = reactive<AdminProductInput>(clone({
  ...emptyProduct,
  ...props.initial,
  compareAtPrice: props.initial?.compareAtPrice ?? null,
  images: props.initial?.images || (initialImage ? [initialImage] : []),
}))

function addVariant() {
  form.variants.push({ sku: '', size: '', color: 'Black', stock: 0, active: true })
}

async function uploadImage(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return
  const remaining = Math.max(0, 8 - form.images.length)
  const selected = files.slice(0, remaining)
  const failures: string[] = []
  if (files.length > remaining) failures.push(`Only ${remaining} more image${remaining === 1 ? '' : 's'} can be added.`)
  uploading.value = true
  uploadError.value = ''
  for (const file of selected) {
    try {
      const body = new FormData()
      body.append('image', file)
      const response = await $fetch<{ url: string }>('/api/admin/media', { method: 'POST', body })
      if (!form.images.includes(response.url)) form.images.push(response.url)
      else failures.push(`${file.name}: this image is already in the gallery.`)
    } catch (cause: unknown) {
      const failure = cause as { data?: { statusMessage?: string } }
      failures.push(`${file.name}: ${failure.data?.statusMessage || 'the image could not be uploaded.'}`)
    }
  }
  form.image = form.images[0] || ''
  uploadError.value = failures.join(' ')
  uploading.value = false
  input.value = ''
}

function moveImage(index: number, offset: -1 | 1) {
  const target = index + offset
  if (target < 0 || target >= form.images.length) return
  ;[form.images[index], form.images[target]] = [form.images[target]!, form.images[index]!]
  form.image = form.images[0] || ''
}

async function removeImage(index: number) {
  const [image = ''] = form.images.splice(index, 1)
  form.image = form.images[0] || ''
  const initialImages = props.initial?.images || (props.initial?.image ? [props.initial.image] : [])
  if (!image.startsWith('/api/media/') || initialImages.includes(image)) return
  try { await $fetch('/api/admin/media', { method: 'DELETE', query: { url: image } }) }
  catch { uploadError.value = 'The unused upload could not be deleted.' }
}

function submitForm() {
  const payload = clone(form)
  payload.image = payload.images[0] || ''
  if ((payload.compareAtPrice as unknown) === '') payload.compareAtPrice = null
  emit('submit', payload)
}
</script>

<template>
  <form class="admin-product-form" @submit.prevent="submitForm">
    <AdminSection title="General" description="Storefront identity and collection placement.">
      <div class="admin-product-form__grid">
        <AdminInput v-model="form.name.en" label="Name — English" required />
        <AdminInput v-model="form.name.ar" label="Name — Arabic" required dir="rtl" />
        <AdminInput v-model="form.slug" label="URL slug" required help="Lowercase letters, numbers, and hyphens." />
        <AdminInput v-model="form.code" label="Product code" required />
        <AdminSelect v-model="form.category" label="Category" required>
          <option v-for="category in categories || []" :key="category.id" :value="category.slug">
            {{ category.name.en }}{{ category.active ? '' : ' — inactive' }}
          </option>
        </AdminSelect>
        <AdminCheckbox v-model="form.active" label="Available on storefront" />
        <AdminTextarea v-model="form.description.en" label="Description — English" required />
        <AdminTextarea v-model="form.description.ar" label="Description — Arabic" required dir="rtl" />
        <AdminTextarea v-model="form.detail.en" label="Details — English" required />
        <AdminTextarea v-model="form.detail.ar" label="Details — Arabic" required dir="rtl" />
        <AdminTextarea v-model="form.fit.en" label="Fit — English" required />
        <AdminTextarea v-model="form.fit.ar" label="Fit — Arabic" required dir="rtl" />
      </div>
    </AdminSection>

    <AdminSection title="Media" description="Add up to eight images. The first image is the storefront primary image.">
      <div class="admin-product-gallery" :aria-busy="uploading || undefined">
        <div class="admin-product-gallery__toolbar">
          <label class="admin-product-media__upload">
            <span>{{ uploading ? 'Uploading images' : 'Upload product images' }}</span>
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" :disabled="uploading || form.images.length >= 8" @change="uploadImage" />
          </label>
          <p>{{ form.images.length }} / 8 images · JPG, PNG, or WebP · Maximum 5 MB each.</p>
        </div>
        <ol v-if="form.images.length" class="admin-product-gallery__list">
          <li v-for="(image, index) in form.images" :key="image" class="admin-product-gallery__item">
            <div class="admin-product-media__preview">
              <StoreImage :src="image" sizes="220px" :alt="`${form.name.en || 'Product'} image ${index + 1}`" />
              <span v-if="index === 0" class="admin-product-gallery__primary">Primary</span>
            </div>
            <div class="admin-product-gallery__actions">
              <button type="button" class="admin-product-gallery__action" :disabled="index === 0" :aria-label="`Move previous image ${index + 1}`" @click="moveImage(index, -1)">Move previous</button>
              <button type="button" class="admin-product-gallery__action" :disabled="index === form.images.length - 1" :aria-label="`Move next image ${index + 1}`" @click="moveImage(index, 1)">Move next</button>
              <button type="button" class="admin-product-gallery__action" :aria-label="`Remove image ${index + 1}`" @click="removeImage(index)">Remove image</button>
            </div>
          </li>
        </ol>
        <p v-else class="admin-product-gallery__empty">No images selected. Add at least one image before saving.</p>
        <p v-if="uploadError" class="admin-field__error" role="alert">{{ uploadError }}</p>
      </div>
    </AdminSection>

    <AdminSection title="Pricing" description="The current price is used for checkout. Add a higher previous price to show the saving.">
      <div class="admin-product-form__pricing">
        <div class="admin-field">
          <label class="admin-field__label" for="admin-product-price">Current price (EGP)</label>
          <input id="admin-product-price" v-model.number="form.price" class="admin-field__control" type="number" min="0" step="1" required />
        </div>
        <div class="admin-field">
          <label class="admin-field__label" for="admin-product-compare-price">Previous price (EGP) — optional</label>
          <input id="admin-product-compare-price" v-model.number="form.compareAtPrice" class="admin-field__control" type="number" :min="form.price + 1" step="1" aria-describedby="admin-product-compare-price-help" />
          <p id="admin-product-compare-price-help" class="admin-field__help">Leave empty when the product is not on sale. Must be higher than the current price.</p>
        </div>
      </div>
    </AdminSection>

    <AdminSection title="Variants & inventory" description="Add sellable variants here. Update existing stock from Inventory to prevent conflicting writes.">
      <template v-if="initial" #actions><NuxtLink to="/admin/inventory" class="admin-button admin-button--quiet">Manage inventory</NuxtLink></template>
      <div class="admin-product-variants">
        <div v-for="(variant, index) in form.variants" :key="variant.id || index" class="admin-product-variant">
          <AdminInput v-model="variant.sku" label="SKU" required />
          <AdminInput v-model="variant.size" label="Size" required />
          <AdminInput v-model="variant.color" label="Color" required />
          <div class="admin-field"><label class="admin-field__label" :for="`variant-stock-${index}`">Stock</label>
            <input :id="`variant-stock-${index}`" v-model.number="variant.stock" class="admin-field__control" type="number" min="0" step="1" required :disabled="!!variant.id" /></div>
          <AdminCheckbox v-model="variant.active" label="Active" />
          <button type="button" class="admin-product-variant__remove" :aria-label="`Remove ${variant.sku || 'variant'}`" @click="form.variants.splice(index, 1)"><KhtIcon name="close" /></button>
        </div>
        <AdminButton variant="secondary" @click="addVariant">Add variant</AdminButton>
      </div>
    </AdminSection>

    <p v-if="error" class="admin-create-order__error" role="alert">{{ error }}</p>
    <footer class="admin-product-form__actions">
      <NuxtLink to="/admin/products" class="admin-button admin-button--quiet">Cancel</NuxtLink>
      <AdminButton type="submit" :loading="busy" :disabled="busy || uploading" loading-label="Saving product">Save product</AdminButton>
    </footer>
  </form>
</template>
