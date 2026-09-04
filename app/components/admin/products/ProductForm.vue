<script setup lang="ts">
import type { AdminProductInput } from '../../../../shared/adminProduct'
import type { AdminCategory } from '../../../../shared/adminCategory'

const props = defineProps<{ initial?: AdminProductInput; busy?: boolean; error?: string }>()
const emit = defineEmits<{ submit: [value: AdminProductInput] }>()
const clone = (value: AdminProductInput) => JSON.parse(JSON.stringify(value)) as AdminProductInput
const uploading = ref(false)
const uploadError = ref('')
const { data: categories } = await useFetch<AdminCategory[]>('/api/admin/categories')
const form = reactive<AdminProductInput>(clone(props.initial || {
  slug: '', code: '', category: 'tees', price: 0, image: '', active: true,
  name: { en: '', ar: '' }, description: { en: '', ar: '' }, detail: { en: '', ar: '' },
  fit: { en: '', ar: '' }, variants: [],
}))

function addVariant() {
  form.variants.push({ sku: '', size: '', color: 'Black', stock: 0, active: true })
}

async function uploadImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  uploadError.value = ''
  try {
    const body = new FormData()
    body.append('image', file)
    const response = await $fetch<{ url: string }>('/api/admin/media', { method: 'POST', body })
    form.image = response.url
  } catch (cause: unknown) {
    const failure = cause as { data?: { statusMessage?: string } }
    uploadError.value = failure.data?.statusMessage || 'The image could not be uploaded.'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function removeImage() {
  const image = form.image
  form.image = ''
  if (!image.startsWith('/api/media/') || image === props.initial?.image) return
  try { await $fetch('/api/admin/media', { method: 'DELETE', query: { url: image } }) }
  catch { uploadError.value = 'The unused upload could not be deleted.' }
}
</script>

<template>
  <form class="admin-product-form" @submit.prevent="emit('submit', clone(form))">
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

    <AdminSection title="Media" description="The storefront currently supports one primary product image.">
      <div class="admin-product-media">
        <div class="admin-product-media__preview">
          <StoreImage v-if="form.image" :src="form.image" sizes="180px" :alt="form.name.en || 'Product preview'" />
          <span v-else>No image selected</span>
        </div>
        <div>
          <label class="admin-product-media__upload">
            <span>{{ uploading ? 'Uploading image' : 'Upload primary image' }}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="uploading" @change="uploadImage" />
          </label>
          <button v-if="form.image" type="button" class="admin-product-media__remove" @click="removeImage">Remove image</button>
          <p>JPG, PNG, or WebP. Maximum 5 MB.</p>
          <p v-if="uploadError" class="admin-field__error" role="alert">{{ uploadError }}</p>
        </div>
      </div>
    </AdminSection>

    <AdminSection title="Pricing" description="Base price used by every current variant.">
      <div class="admin-product-form__narrow">
        <label class="admin-field__label" for="admin-product-price">Price (EGP)</label>
        <input id="admin-product-price" v-model.number="form.price" class="admin-field__control" type="number" min="0" step="1" required />
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
      <AdminButton type="submit" :loading="busy" loading-label="Saving product">Save product</AdminButton>
    </footer>
  </form>
</template>