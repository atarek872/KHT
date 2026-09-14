<script setup lang="ts">
import type {
  WelcomeCampaignAdminPayload,
  WelcomeCampaignInput,
} from '../../../shared/welcomeCampaign'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Welcome Campaign — KHT Admin', robots: 'noindex, nofollow' })

const {
  data,
  error: loadError,
  status,
  refresh,
} = await useFetch<WelcomeCampaignAdminPayload>('/api/admin/welcome-campaign')
const form = ref<WelcomeCampaignInput | null>(null)
const busy = ref(false)
const message = ref('')
const saveError = ref('')

watch(
  data,
  (payload) => {
    if (!payload || form.value) return
    const campaign = payload.campaign
    form.value = {
      enabled: campaign.enabled,
      discountId: campaign.discountId,
      desktopDelaySeconds: campaign.desktopDelaySeconds,
      mobileDelaySeconds: campaign.mobileDelaySeconds,
      dismissalDays: campaign.dismissalDays,
      displayMode: campaign.displayMode,
      displayPath: campaign.displayPath,
      eyebrow: { ...campaign.eyebrow },
      title: { ...campaign.title },
      body: { ...campaign.body },
      primaryLabel: { ...campaign.primaryLabel },
      primaryRedirect: campaign.primaryRedirect,
      secondaryLabel: { ...campaign.secondaryLabel },
      secondaryRedirect: campaign.secondaryRedirect,
    }
  },
  { immediate: true },
)

const selectedDiscount = computed(() =>
  data.value?.discounts.find((discount) => discount.id === form.value?.discountId),
)
const discountRule = computed(() => {
  const discount = selectedDiscount.value
  if (!discount) return 'Choose a coupon'
  return discount.type === 'percentage' ? `${discount.value}% off` : `${discount.value} EGP off`
})

async function save() {
  if (!form.value || busy.value) return
  busy.value = true
  message.value = ''
  saveError.value = ''
  try {
    await $fetch('/api/admin/welcome-campaign', { method: 'PUT', body: form.value })
    await refresh()
    message.value = 'Welcome campaign saved. Storefront changes are live.'
  } catch (cause: unknown) {
    saveError.value =
      (cause as { data?: { statusMessage?: string } }).data?.statusMessage ||
      'Welcome campaign could not be saved.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="admin-shell__page admin-welcome-campaign-page">
    <AdminPageHeader
      eyebrow="KHT / Acquisition"
      title="Welcome campaign"
      description="Control the storefront prompt, timing, destinations and selected coupon."
    />
    <div v-if="status === 'pending' && !data" class="admin-orders-loading" role="status">
      <AdminLoader label="Loading welcome campaign" /><span />
    </div>
    <AdminEmptyState
      v-else-if="loadError || !form"
      title="Campaign unavailable"
      description="The welcome campaign settings could not be loaded."
    >
      <template #actions><AdminButton @click="refresh()">Retry</AdminButton></template>
    </AdminEmptyState>
    <form v-else class="admin-welcome-campaign-form" @submit.prevent="save">
      <AdminSection
        title="Campaign status"
        description="Keep the campaign optional and non-blocking for storefront visitors."
      >
        <div class="admin-campaign-fields admin-campaign-fields--rules">
          <AdminCheckbox
            v-model="form.enabled"
            label="Campaign active"
            help="Turning this off hides the prompt and stops automatic campaign application."
          />
          <AdminSelect
            v-model="form.discountId"
            label="Coupon"
            help="Create or edit coupon value, minimum and dates from Discounts."
            required
          >
            <option
              v-for="discount in data?.discounts || []"
              :key="discount.id"
              :value="discount.id"
            >
              {{ discount.code }} —
              {{ discount.type === 'percentage' ? `${discount.value}%` : `${discount.value} EGP`
              }}{{ discount.active ? '' : ' (inactive)' }}
            </option>
          </AdminSelect>
          <p
            v-if="selectedDiscount && !selectedDiscount.active"
            class="admin-state-notice"
            role="status"
          >
            The selected coupon is inactive, so the storefront campaign remains hidden.
          </p>
        </div>
      </AdminSection>

      <AdminSection
        title="Display timing"
        description="30 seconds on desktop and 60 seconds on mobile are the recommended starting points."
      >
        <div class="admin-campaign-fields admin-campaign-fields--three">
          <AdminInput
            v-model="form.desktopDelaySeconds"
            label="Desktop delay (seconds)"
            type="number"
            min="5"
            max="300"
            required
          />
          <AdminInput
            v-model="form.mobileDelaySeconds"
            label="Mobile delay (seconds)"
            type="number"
            min="10"
            max="300"
            required
          />
          <AdminInput
            v-model="form.dismissalDays"
            label="Dismiss for (days)"
            type="number"
            min="1"
            max="365"
            help="A dismissed campaign stays hidden for this visitor."
            required
          />
        </div>
      </AdminSection>

      <AdminSection
        title="Display placement"
        description="Show the prompt on the homepage or on one exact public store page."
      >
        <div class="admin-campaign-fields">
          <AdminSelect
            v-model="form.displayMode"
            label="Show on"
            help="The prompt appears only on the selected page after the configured delay."
            required
          >
            <option value="home">Homepage</option>
            <option value="path">Specific page</option>
          </AdminSelect>
          <AdminInput
            v-if="form.displayMode === 'path'"
            v-model="form.displayPath"
            label="Page path"
            placeholder="/drops/001"
            help="Use the part after kht-eg.com, for example /shop or /drops/001."
            maxlength="200"
            required
          />
        </div>
      </AdminSection>

      <AdminSection
        title="Campaign copy"
        description="Both languages update the storefront prompt and checkout sign-in message."
      >
        <div class="admin-campaign-language-grid">
          <div>
            <h3>English</h3>
            <AdminInput v-model="form.eyebrow.en" label="English eyebrow" maxlength="80" required />
            <AdminInput v-model="form.title.en" label="English title" maxlength="140" required />
            <AdminTextarea v-model="form.body.en" label="English body" maxlength="400" required />
            <AdminInput
              v-model="form.primaryLabel.en"
              label="English primary button"
              maxlength="80"
              required
            />
            <AdminInput
              v-model="form.secondaryLabel.en"
              label="English secondary link"
              maxlength="100"
              required
            />
          </div>
          <div dir="rtl">
            <h3>العربية</h3>
            <AdminInput v-model="form.eyebrow.ar" label="Arabic eyebrow" maxlength="80" required />
            <AdminInput v-model="form.title.ar" label="Arabic title" maxlength="140" required />
            <AdminTextarea v-model="form.body.ar" label="Arabic body" maxlength="400" required />
            <AdminInput
              v-model="form.primaryLabel.ar"
              label="Arabic primary button"
              maxlength="80"
              required
            />
            <AdminInput
              v-model="form.secondaryLabel.ar"
              label="Arabic secondary link"
              maxlength="100"
              required
            />
          </div>
        </div>
      </AdminSection>

      <AdminSection
        title="Destinations"
        description="Use a store path beginning with /. Add {current} to return customers to the page they were viewing."
      >
        <div class="admin-campaign-fields">
          <AdminInput
            v-model="form.primaryRedirect"
            label="Primary destination"
            placeholder="/account/register?returnTo={current}"
            maxlength="300"
            required
          />
          <AdminInput
            v-model="form.secondaryRedirect"
            label="Secondary destination"
            placeholder="/account/login?returnTo={current}"
            maxlength="300"
            required
          />
        </div>
      </AdminSection>

      <AdminSection
        title="Coupon eligibility"
        description="Eligibility belongs to the selected coupon, so its rules remain protected anywhere the code is entered."
      >
        <div v-if="selectedDiscount" class="admin-campaign-eligibility">
          <dl>
            <div>
              <dt>Audience</dt>
              <dd>
                {{ selectedDiscount.loginRequired ? 'Signed-in customers' : 'All customers' }}
              </dd>
            </div>
            <div>
              <dt>Per customer</dt>
              <dd>{{ selectedDiscount.oncePerCustomer ? 'One use' : 'No account limit' }}</dd>
            </div>
            <div>
              <dt>Order history</dt>
              <dd>{{ selectedDiscount.firstOrderOnly ? 'First order only' : 'Any order' }}</dd>
            </div>
          </dl>
          <NuxtLink
            :to="`/admin/discounts/${selectedDiscount.id}`"
            class="admin-button admin-button--quiet"
            >Edit coupon eligibility</NuxtLink
          >
        </div>
      </AdminSection>

      <AdminSection
        title="Preview"
        description="A compact content preview using the selected coupon."
      >
        <article class="admin-campaign-preview">
          <span>{{ form.eyebrow.en }}</span>
          <strong>{{ discountRule }}</strong>
          <h3>{{ form.title.en }}</h3>
          <p>{{ form.body.en }}</p>
          <span class="admin-button admin-button--primary">{{ form.primaryLabel.en }}</span>
        </article>
      </AdminSection>

      <p v-if="message" class="admin-state-notice" role="status">{{ message }}</p>
      <p v-if="saveError" class="admin-create-order__error" role="alert">{{ saveError }}</p>
      <footer class="admin-product-form__actions">
        <NuxtLink to="/admin/discounts" class="admin-button admin-button--quiet"
          >Manage coupons</NuxtLink
        >
        <AdminButton type="submit" :loading="busy" loading-label="Saving campaign">
          Save campaign
        </AdminButton>
      </footer>
    </form>
  </div>
</template>
