<script setup lang="ts">
import type { AdminCategoryInput } from '../../../../shared/adminCategory'

const props = defineProps<{ initial?: AdminCategoryInput; busy?: boolean; error?: string }>()
const emit = defineEmits<{ submit: [value: AdminCategoryInput] }>()
const clone = (value: AdminCategoryInput) => JSON.parse(JSON.stringify(value)) as AdminCategoryInput
const form = reactive<AdminCategoryInput>(clone(props.initial || {
  slug: '', name: { en: '', ar: '' }, image: '', active: true, sortOrder: 0,
}))
const uploading = ref(false)
const uploadError = ref('')

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
    uploadError.value = (cause as { data?: { statusMessage?: string } }).data?.statusMessage || 'The image could not be uploaded.'
  } finally { uploading.value = false; input.value = '' }
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
  <form class="admin-category-form" @submit.prevent="emit('submit', clone(form))">
    <AdminSection title="Category" description="Name, route, and storefront order.">
      <div class="admin-category-form__fields">
        <AdminInput v-model="form.name.en" label="Name — English" required />
        <AdminInput v-model="form.name.ar" label="Name — Arabic" required dir="rtl" />
        <AdminInput v-model="form.slug" label="URL slug" required help="Lowercase letters, numbers, and hyphens." />
        <div class="admin-field"><label class="admin-field__label" for="category-sort-order">Sort order</label>
          <input id="category-sort-order" v-model.number="form.sortOrder" class="admin-field__control" type="number" step="1" required /></div>
        <AdminCheckbox v-model="form.active" label="Visible on storefront" />
      </div>
    </AdminSection>
    <AdminSection title="Image" description="Used by storefront category presentation.">
      <div class="admin-product-media">
        <div class="admin-product-media__preview"><StoreImage v-if="form.image" :src="form.image" sizes="180px" :alt="form.name.en || 'Category preview'" /><span v-else>No image selected</span></div>
        <div><label class="admin-product-media__upload"><span>{{ uploading ? 'Uploading image' : 'Upload category image' }}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="uploading" @change="uploadImage" /></label>
          <button v-if="form.image" type="button" class="admin-product-media__remove" @click="removeImage">Remove image</button>
          <p>JPG, PNG, or WebP. Maximum 5 MB.</p><p v-if="uploadError" class="admin-field__error" role="alert">{{ uploadError }}</p></div>
      </div>
    </AdminSection>
    <p v-if="error" class="admin-create-order__error" role="alert">{{ error }}</p>
    <footer class="admin-product-form__actions"><NuxtLink to="/admin/categories" class="admin-button admin-button--quiet">Cancel</NuxtLink>
      <AdminButton type="submit" :loading="busy" loading-label="Saving category">Save category</AdminButton></footer>
  </form>
</template>