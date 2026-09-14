<script setup lang="ts">
import type { PublicStoreCurtain } from '../../shared/storeCurtain'

const props = withDefaults(
  defineProps<{ curtain: PublicStoreCurtain; preview?: boolean; language?: 'en' | 'ar' }>(),
  { preview: false, language: undefined },
)
const emit = defineEmits<{ expired: [] }>()
const { locale } = useLanguage()
const panel = ref<HTMLElement>()
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
let expiredEmitted = false
let previousOverflow = ''

const activeLocale = computed(() => props.language || locale.value)
const localized = (value: { en: string; ar: string }) => value[activeLocale.value]
const targetTime = computed(() =>
  props.curtain.countdownEnabled && props.curtain.launchAt
    ? new Date(props.curtain.launchAt).getTime()
    : null,
)
const remaining = computed(() => Math.max(0, (targetTime.value || 0) - now.value))
const countdown = computed(() => {
  let seconds = Math.floor(remaining.value / 1000)
  const days = Math.floor(seconds / 86400)
  seconds -= days * 86400
  const hours = Math.floor(seconds / 3600)
  seconds -= hours * 3600
  const minutes = Math.floor(seconds / 60)
  seconds -= minutes * 60
  return [
    { key: 'days', value: days, en: 'Days', ar: 'يوم' },
    { key: 'hours', value: hours, en: 'Hours', ar: 'ساعة' },
    { key: 'minutes', value: minutes, en: 'Minutes', ar: 'دقيقة' },
    { key: 'seconds', value: seconds, en: 'Seconds', ar: 'ثانية' },
  ]
})
const targetDescription = computed(() => {
  if (!props.curtain.launchAt) return ''
  return new Intl.DateTimeFormat(activeLocale.value === 'ar' ? 'ar-EG' : 'en-EG', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Cairo',
  }).format(new Date(props.curtain.launchAt))
})
const externalCta = computed(() => /^https:\/\//i.test(props.curtain.ctaUrl))

function tick() {
  now.value = Date.now()
  if (
    !props.preview &&
    !expiredEmitted &&
    targetTime.value !== null &&
    remaining.value === 0 &&
    props.curtain.autoDisableAtLaunch
  ) {
    expiredEmitted = true
    emit('expired')
  }
}

onMounted(() => {
  tick()
  if (targetTime.value !== null) timer = setInterval(tick, 1000)
  if (!props.preview) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    nextTick(() => panel.value?.focus())
  }
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  if (!props.preview) document.body.style.overflow = previousOverflow
})
</script>

<template>
  <section
    ref="panel"
    class="store-curtain"
    :class="{ 'store-curtain--preview': preview }"
    :role="preview ? 'region' : 'dialog'"
    :aria-modal="preview ? undefined : 'true'"
    aria-labelledby="store-curtain-title"
    aria-describedby="store-curtain-message"
    :tabindex="preview ? undefined : -1"
    :dir="activeLocale === 'ar' ? 'rtl' : 'ltr'"
  >
    <div class="store-curtain__frame">
      <div class="store-curtain__brand" aria-label="KHT">KHT</div>
      <img v-if="curtain.imageUrl" class="store-curtain__image" :src="curtain.imageUrl" alt="" />
      <p class="store-curtain__mode">
        {{
          curtain.mode === 'coming_soon'
            ? activeLocale === 'ar'
              ? 'الفصل القادم'
              : 'THE NEXT CHAPTER'
            : curtain.mode === 'under_construction'
              ? activeLocale === 'ar'
                ? 'تحديث المتجر'
                : 'STORE UPDATE'
              : activeLocale === 'ar'
                ? 'KHT / إعلان'
                : 'KHT / ANNOUNCEMENT'
        }}
      </p>
      <h1 id="store-curtain-title">{{ localized(curtain.title) }}</h1>
      <p id="store-curtain-message" class="store-curtain__message">
        {{ localized(curtain.message) }}
      </p>

      <div
        v-if="curtain.countdownEnabled && curtain.launchAt"
        class="store-curtain__countdown"
        :aria-label="`${activeLocale === 'ar' ? 'موعد الافتتاح' : 'Opening time'}: ${targetDescription}`"
      >
        <div v-for="unit in countdown" :key="unit.key" class="store-curtain__time">
          <strong aria-hidden="true">{{ String(unit.value).padStart(2, '0') }}</strong>
          <span aria-hidden="true">{{ activeLocale === 'ar' ? unit.ar : unit.en }}</span>
        </div>
      </div>

      <a
        v-if="curtain.ctaEnabled && externalCta"
        class="store-curtain__cta"
        :href="curtain.ctaUrl"
        target="_blank"
        rel="noopener noreferrer"
        >{{ localized(curtain.ctaLabel) }}</a
      >
      <NuxtLink v-else-if="curtain.ctaEnabled" class="store-curtain__cta" :to="curtain.ctaUrl">{{
        localized(curtain.ctaLabel)
      }}</NuxtLink>

      <p class="store-curtain__signature">BLACK. WHITE. LINE.</p>
    </div>
  </section>
</template>
