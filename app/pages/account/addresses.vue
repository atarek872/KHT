<script setup lang="ts">
import type { CustomerAddress } from '../../../shared/account'
definePageMeta({ middleware: 'customer' })
const { t } = useLanguage()
const {
  data,
  error: loadError,
  status,
  refresh,
} = await useFetch<{ items: CustomerAddress[] }>('/api/account/addresses', {
  key: 'customer-addresses',
})
const { data: zones } = await useFetch<{ items: { governorate: string }[] }>(
  '/api/shipping/options',
)
const blank = () => ({
  label: '',
  name: '',
  phone: '',
  address: '',
  city: '',
  governorate: '',
  isDefault: false,
})
const form = reactive(blank()),
  editing = ref<string | null>(null),
  visible = ref(false),
  busy = ref(false),
  error = ref(''),
  message = ref(''),
  deleting = ref('')
function edit(item?: CustomerAddress) {
  Object.assign(form, item || blank())
  editing.value = item?.id || null
  visible.value = true
  error.value = ''
  nextTick(() => document.getElementById('address-label')?.focus())
}
async function save() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  message.value = ''
  try {
    if (editing.value)
      await $fetch(`/api/account/addresses/${editing.value}`, { method: 'PATCH', body: form })
    else await $fetch('/api/account/addresses', { method: 'POST', body: form })
    visible.value = false
    await refresh()
    message.value = t('Address saved.', 'تم حفظ العنوان.')
  } catch (cause) {
    error.value = customerError(cause)
  } finally {
    busy.value = false
  }
}
async function remove(id: string) {
  busy.value = true
  error.value = ''
  try {
    await $fetch(`/api/account/addresses/${id}`, { method: 'DELETE' })
    deleting.value = ''
    await refresh()
    message.value = t('Address removed.', 'تم حذف العنوان.')
  } catch (cause) {
    error.value = customerError(cause)
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <AccountShell
    :title="t('ADDRESS BOOK.', 'دفتر العناوين.')"
    :intro="t('Your usual places, ready for checkout.', 'عناوينك المعتادة جاهزة لإتمام الطلب.')"
  >
    <p v-if="loadError" role="alert">
      {{ t('Could not load addresses.', 'تعذر تحميل العناوين.') }}
      <button class="account-text-button" @click="refresh()">
        {{ t('Try again', 'حاول مجدداً') }}
      </button>
    </p>
    <p v-else-if="status === 'pending'" role="status">
      {{ t('Loading addresses…', 'جاري تحميل العناوين…') }}
    </p>
    <p v-if="error" role="alert" class="account-notice">{{ error }}</p>
    <p v-if="message" role="status" class="account-notice">{{ message }}</p>
    <div v-if="!visible" class="account-addresses">
      <p v-if="!loadError && !data?.items.length" class="account-empty">
        {{
          t(
            'No saved addresses yet. Add one for a quicker checkout.',
            'لا توجد عناوين محفوظة. أضف عنواناً لإتمام الطلب أسرع.',
          )
        }}
      </p>
      <article v-for="item in data?.items" :key="item.id" class="account-address">
        <div class="account-row">
          <h2>{{ item.label }}</h2>
          <span v-if="item.isDefault" class="account-badge">{{ t('Default', 'الافتراضي') }}</span>
        </div>
        <p>
          {{ item.name }}<br />{{ item.address }}<br />{{ item.city }} · {{ item.governorate
          }}<br /><bdi>{{ item.phone }}</bdi>
        </p>
        <div class="account-row">
          <button class="account-text-button" @click="edit(item)">{{ t('Edit', 'تعديل') }}</button
          ><button class="account-text-button" @click="deleting = item.id">
            {{ t('Remove', 'حذف') }}
          </button>
        </div>
        <div v-if="deleting === item.id" class="account-notice">
          <p>{{ t('Remove this saved address?', 'حذف هذا العنوان المحفوظ؟') }}</p>
          <div class="account-row">
            <button class="account-text-button" :disabled="busy" @click="remove(item.id)">
              {{ t('Yes, remove', 'نعم، احذف') }}</button
            ><button class="account-text-button" :disabled="busy" @click="deleting = ''">
              {{ t('Keep address', 'الاحتفاظ بالعنوان') }}
            </button>
          </div>
        </div>
      </article>
      <button class="button button-dark" @click="edit()">
        {{ t('Add an address', 'إضافة عنوان') }}<KhtIcon name="plus" />
      </button>
    </div>
    <section v-else class="account-section">
      <h2>{{ editing ? t('Edit address', 'تعديل العنوان') : t('New address', 'عنوان جديد') }}</h2>
      <form class="account-form" @submit.prevent="save">
        <label for="address-label">{{
          t('Address label (e.g. Home)', 'اسم العنوان (مثلاً المنزل)')
        }}</label
        ><input id="address-label" v-model="form.label" required maxlength="80" /><label
          for="address-name"
          >{{ t('Recipient name', 'اسم المستلم') }}</label
        ><input
          id="address-name"
          v-model="form.name"
          required
          autocomplete="name"
          maxlength="120"
        /><label for="address-phone">{{ t('Phone number', 'رقم الهاتف') }}</label
        ><input
          id="address-phone"
          v-model="form.phone"
          required
          type="tel"
          autocomplete="tel"
          maxlength="30"
        /><label for="address-street">{{
          t('Street, building & apartment', 'الشارع والمبنى والشقة')
        }}</label
        ><textarea
          id="address-street"
          v-model="form.address"
          required
          autocomplete="street-address"
          maxlength="1000"
          rows="3"
        /><label for="address-city">{{ t('City / district', 'المدينة / المنطقة') }}</label
        ><input
          id="address-city"
          v-model="form.city"
          required
          autocomplete="address-level2"
          maxlength="100"
        /><label for="address-governorate">{{ t('Governorate', 'المحافظة') }}</label
        ><select
          id="address-governorate"
          v-if="zones?.items.length"
          v-model="form.governorate"
          required
          autocomplete="address-level1"
        >
          <option value="" disabled>{{ t('Choose governorate', 'اختر المحافظة') }}</option>
          <option v-for="zone in zones.items" :key="zone.governorate" :value="zone.governorate">
            {{ zone.governorate }}
          </option></select
        ><input
          v-else
          id="address-governorate"
          v-model="form.governorate"
          required
          autocomplete="address-level1"
          maxlength="100"
        /><label class="checkbox-label"
          ><input v-model="form.isDefault" type="checkbox" />{{
            t('Use as my default address', 'استخدام كعنوان افتراضي')
          }}</label
        >
        <div class="account-row">
          <button class="button button-dark" :disabled="busy">
            {{ busy ? t('Saving…', 'جاري الحفظ…') : t('Save address', 'حفظ العنوان') }}</button
          ><button
            type="button"
            class="account-text-button"
            :disabled="busy"
            @click="visible = false"
          >
            {{ t('Cancel', 'إلغاء') }}
          </button>
        </div>
      </form>
    </section>
  </AccountShell>
</template>
