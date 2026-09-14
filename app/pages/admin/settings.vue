<script setup lang="ts">
import type {
  PublicStoreCurtain,
  StoreCurtain,
  StoreCurtainInput,
} from '../../../shared/storeCurtain'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Settings — KHT Admin', robots: 'noindex, nofollow' })

const { data, error, status, refresh } = await useFetch<StoreCurtain>('/api/admin/store-curtain')
const form = reactive<StoreCurtainInput>({
  enabled: false,
  mode: 'coming_soon',
  title: { en: 'COMING SOON.', ar: 'قريباً.' },
  message: { en: 'The next KHT chapter is almost here.', ar: 'الفصل الجديد من KHT قريب.' },
  imageUrl: null,
  countdownEnabled: false,
  launchAt: null,
  autoDisableAtLaunch: true,
  ctaEnabled: false,
  ctaLabel: { en: 'Follow KHT', ar: 'تابع KHT' },
  ctaUrl: '/',
})
const launchAtLocal = ref('')
const saving = ref(false)
const uploading = ref(false)
const feedback = ref('')
const feedbackError = ref(false)
const originalImage = ref<string | null>(null)
const newlyUploadedImage = ref<string | null>(null)
const previewLanguage = ref<'en' | 'ar'>('en')

const cairoFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function cairoInputValue(value: string | null) {
  if (!value) return ''
  const parts = Object.fromEntries(
    cairoFormatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

function cairoOffset(at: Date) {
  const parts = Object.fromEntries(
    cairoFormatter.formatToParts(at).map((part) => [part.type, part.value]),
  )
  const represented = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  )
  return represented - at.getTime()
}

function cairoLocalToIso(value: string) {
  const assumedUtc = Date.parse(`${value}:00Z`)
  let result = new Date(assumedUtc)
  for (let index = 0; index < 2; index += 1) result = new Date(assumedUtc - cairoOffset(result))
  return result.toISOString()
}

watch(
  data,
  (settings) => {
    if (!settings) return
    Object.assign(form, {
      enabled: settings.enabled,
      mode: settings.mode,
      title: { ...settings.title },
      message: { ...settings.message },
      imageUrl: settings.imageUrl,
      countdownEnabled: settings.countdownEnabled,
      launchAt: settings.launchAt,
      autoDisableAtLaunch: settings.autoDisableAtLaunch,
      ctaEnabled: settings.ctaEnabled,
      ctaLabel: { ...settings.ctaLabel },
      ctaUrl: settings.ctaUrl,
    })
    launchAtLocal.value = cairoInputValue(settings.launchAt)
    originalImage.value = settings.imageUrl
    newlyUploadedImage.value = null
  },
  { immediate: true },
)

const previewCurtain = computed<PublicStoreCurtain>(() => ({
  ...JSON.parse(JSON.stringify(form)),
  enabled: true,
  launchAt:
    form.countdownEnabled && launchAtLocal.value ? cairoLocalToIso(launchAtLocal.value) : null,
  revision: 'preview',
}))

function applyModePreset() {
  if (form.mode === 'coming_soon') {
    form.title = { en: 'COMING SOON.', ar: 'قريباً.' }
    form.message = { en: 'The next KHT chapter is almost here.', ar: 'الفصل الجديد من KHT قريب.' }
  } else if (form.mode === 'under_construction') {
    form.title = { en: 'UNDER CONSTRUCTION.', ar: 'المتجر قيد التجهيز.' }
    form.message = {
      en: 'We are preparing a better KHT experience.',
      ar: 'نعمل على تجهيز تجربة أفضل من KHT.',
    }
  }
}

async function uploadImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  feedback.value = ''
  try {
    if (newlyUploadedImage.value) {
      await $fetch('/api/admin/media', {
        method: 'DELETE',
        query: { url: newlyUploadedImage.value },
      }).catch(() => undefined)
    }
    const body = new FormData()
    body.append('image', file)
    const uploaded = await $fetch<{ url: string }>('/api/admin/media', { method: 'POST', body })
    form.imageUrl = uploaded.url
    newlyUploadedImage.value = uploaded.url
    feedbackError.value = false
  } catch (cause: unknown) {
    const failure = cause as { data?: { statusMessage?: string } }
    feedbackError.value = true
    feedback.value = failure.data?.statusMessage || 'The image could not be uploaded.'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function removeImage() {
  const image = form.imageUrl
  form.imageUrl = null
  if (image && image === newlyUploadedImage.value) {
    await $fetch('/api/admin/media', { method: 'DELETE', query: { url: image } }).catch(
      () => undefined,
    )
    newlyUploadedImage.value = null
  }
}

async function save() {
  saving.value = true
  feedback.value = ''
  try {
    const payload: StoreCurtainInput = JSON.parse(JSON.stringify(form))
    payload.launchAt =
      payload.countdownEnabled && launchAtLocal.value ? cairoLocalToIso(launchAtLocal.value) : null
    await $fetch('/api/admin/store-curtain', { method: 'PUT', body: payload })
    if (originalImage.value && originalImage.value !== payload.imageUrl) {
      await $fetch('/api/admin/media', {
        method: 'DELETE',
        query: { url: originalImage.value },
      }).catch(() => undefined)
    }
    await refresh()
    feedbackError.value = false
    feedback.value = payload.enabled ? 'Store Curtain is live.' : 'The storefront is open.'
  } catch (cause: unknown) {
    const failure = cause as { data?: { statusMessage?: string } }
    feedbackError.value = true
    feedback.value = failure.data?.statusMessage || 'Store Curtain settings could not be saved.'
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(() => {
  if (newlyUploadedImage.value && newlyUploadedImage.value !== originalImage.value) {
    $fetch('/api/admin/media', {
      method: 'DELETE',
      query: { url: newlyUploadedImage.value },
    }).catch(() => undefined)
  }
})
</script>

<template>
  <div class="admin-shell__page admin-store-curtain-page">
    <AdminPageHeader
      eyebrow="KHT / System"
      title="Settings"
      description="Store availability and customer-facing system controls."
    />

    <div v-if="status === 'pending' && !data" class="admin-orders-loading" role="status">
      <AdminLoader label="Loading settings" /><span />
    </div>
    <AdminEmptyState
      v-else-if="error || !data"
      title="Settings unavailable"
      description="Store availability settings could not be loaded."
      ><template #actions
        ><AdminButton @click="refresh()">Retry</AdminButton></template
      ></AdminEmptyState
    >

    <form v-else class="admin-store-curtain" @submit.prevent="save">
      <p
        v-if="feedback"
        :class="feedbackError ? 'admin-create-order__error' : 'admin-state-notice'"
        :role="feedbackError ? 'alert' : 'status'"
      >
        {{ feedback }}
      </p>

      <section
        class="admin-store-curtain__status"
        :class="{ 'admin-store-curtain__status--active': form.enabled }"
      >
        <div>
          <span>Store status</span
          ><strong>{{ form.enabled ? 'STORE CURTAIN ACTIVE' : 'STOREFRONT OPEN' }}</strong>
        </div>
        <AdminCheckbox
          v-model="form.enabled"
          label="Activate Store Curtain"
          help="Saving while active immediately covers every customer-facing page. Admin remains available."
        />
      </section>

      <p v-if="form.enabled" class="admin-store-curtain__warning" role="status">
        Visitors will see this curtain immediately after you save. They cannot close it or use the
        store until it is disabled or the automatic opening time arrives.
      </p>

      <div class="admin-store-curtain__workspace">
        <div class="admin-store-curtain__controls">
          <AdminSection
            title="Store availability"
            description="Choose the message customers see while the storefront is covered."
          >
            <div class="admin-store-curtain__grid">
              <AdminSelect v-model="form.mode" label="Curtain mode" @change="applyModePreset">
                <option value="coming_soon">Coming Soon</option>
                <option value="under_construction">Under Construction</option>
                <option value="custom">Custom message</option>
              </AdminSelect>
              <AdminInput v-model="form.title.en" label="English title" required maxlength="100" />
              <AdminInput
                v-model="form.title.ar"
                label="Arabic title"
                required
                maxlength="100"
                dir="rtl"
              />
              <AdminTextarea
                v-model="form.message.en"
                label="English message"
                required
                maxlength="500"
              />
              <AdminTextarea
                v-model="form.message.ar"
                label="Arabic message"
                required
                maxlength="500"
                dir="rtl"
              />
            </div>
          </AdminSection>

          <AdminSection
            title="Optional image"
            description="Use one focused campaign image. It will appear in black and white."
          >
            <div class="admin-store-curtain__media">
              <img v-if="form.imageUrl" :src="form.imageUrl" alt="Current Store Curtain" />
              <label class="admin-product-media__upload">
                <span>{{
                  uploading ? 'Uploading image' : form.imageUrl ? 'Replace image' : 'Upload image'
                }}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  :disabled="uploading"
                  @change="uploadImage"
                />
              </label>
              <AdminButton v-if="form.imageUrl" variant="quiet" @click="removeImage"
                >Remove image</AdminButton
              >
              <p>JPG, PNG, or WebP · Maximum 5 MB.</p>
            </div>
          </AdminSection>

          <AdminSection title="Countdown" description="Schedule the reveal in Cairo local time.">
            <div class="admin-store-curtain__grid">
              <AdminCheckbox v-model="form.countdownEnabled" label="Enable countdown" />
              <div v-if="form.countdownEnabled" class="admin-field">
                <label class="admin-field__label" for="store-curtain-launch"
                  >Opening date and time — Cairo</label
                >
                <input
                  id="store-curtain-launch"
                  v-model="launchAtLocal"
                  class="admin-field__control"
                  type="datetime-local"
                  required
                />
              </div>
              <AdminCheckbox
                v-if="form.countdownEnabled"
                v-model="form.autoDisableAtLaunch"
                label="Open the store automatically when the countdown ends"
              />
            </div>
          </AdminSection>

          <AdminSection
            title="Optional link"
            description="Send customers to a store page or a secure external profile."
          >
            <div class="admin-store-curtain__grid">
              <AdminCheckbox v-model="form.ctaEnabled" label="Show a button" />
              <template v-if="form.ctaEnabled">
                <AdminInput
                  v-model="form.ctaLabel.en"
                  label="English button label"
                  required
                  maxlength="80"
                />
                <AdminInput
                  v-model="form.ctaLabel.ar"
                  label="Arabic button label"
                  required
                  maxlength="80"
                  dir="rtl"
                />
                <AdminInput
                  v-model="form.ctaUrl"
                  label="Button destination"
                  required
                  help="Use a store path such as /contact or a complete HTTPS link."
                />
              </template>
            </div>
          </AdminSection>
        </div>

        <aside class="admin-store-curtain__preview" aria-label="Store Curtain Preview">
          <div class="admin-store-curtain__preview-bar">
            <span>Preview</span>
            <div aria-label="Preview language">
              <button
                type="button"
                :aria-pressed="previewLanguage === 'en'"
                @click="previewLanguage = 'en'"
              >
                EN
              </button>
              <button
                type="button"
                :aria-pressed="previewLanguage === 'ar'"
                @click="previewLanguage = 'ar'"
              >
                AR
              </button>
            </div>
          </div>
          <StoreCurtain :curtain="previewCurtain" :language="previewLanguage" preview />
        </aside>
      </div>

      <footer class="admin-store-curtain__actions">
        <p v-if="data.updatedBy">
          Last saved by {{ data.updatedBy }} ·
          {{ new Date(data.updatedAt).toLocaleString('en-EG', { timeZone: 'Africa/Cairo' }) }}
        </p>
        <AdminButton
          type="submit"
          :loading="saving"
          :disabled="saving || uploading"
          loading-label="Saving settings"
          >Save settings</AdminButton
        >
      </footer>
    </form>
  </div>
</template>
