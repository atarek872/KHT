<script setup lang="ts">
import { SIZE_FINDER_CONFIG, recommendSetSize, type KhtSetSize } from '#shared/sizeRecommendation'

const props = defineProps<{
  open: boolean
  availableSizes: string[]
  assistanceUrl: string
}>()
const emit = defineEmits<{ close: []; select: [size: KhtSetSize]; guide: [] }>()
const { t } = useLanguage()
const height = ref<number | ''>('')
const weight = ref<number | ''>('')
const preference = ref<'balanced' | 'extra' | ''>('')
const hasBoth = computed(() => height.value !== '' && weight.value !== '')
const result = computed(() =>
  hasBoth.value ? recommendSetSize(height.value, weight.value, props.availableSizes) : null,
)
watch(
  () => props.open,
  (open) => {
    if (!open) {
      height.value = ''
      weight.value = ''
      preference.value = ''
    }
  },
)
const isExternalHelp = computed(() => /^https:\/\//.test(props.assistanceUrl))
</script>

<template>
  <OverlayPanel
    class="size-finder-dialog"
    :open="open"
    :title="t('Find my size', 'اختار مقاسي')"
    @close="emit('close')"
  >
    <div class="size-finder">
      <p class="size-finder__intro">
        {{
          t(
            'Find your KHT oversized set size. Enter your height and weight, then compare the garment measurements for your preferred fit.',
            'اختار مقاس طقم KHT الأوفرسايز. اكتب طولك ووزنك، وقارن قياسات القطعة للفيت اللي تفضله.',
          )
        }}
      </p>
      <div class="size-finder__inputs">
        <label for="finder-height"
          >{{ t('Height (cm)', 'الطول (سم)') }}
          <input
            id="finder-height"
            v-model.number="height"
            type="number"
            inputmode="decimal"
            step="0.5"
            :min="SIZE_FINDER_CONFIG.supportedHeight.min"
            :max="SIZE_FINDER_CONFIG.supportedHeight.max"
            autocomplete="off"
          />
        </label>
        <label for="finder-weight"
          >{{ t('Weight (kg)', 'الوزن (كجم)') }}
          <input
            id="finder-weight"
            v-model.number="weight"
            type="number"
            inputmode="decimal"
            step="0.5"
            :min="SIZE_FINDER_CONFIG.supportedWeight.min"
            :max="SIZE_FINDER_CONFIG.supportedWeight.max"
            autocomplete="off"
          />
        </label>
      </div>
      <p class="size-finder__help">
        {{
          t(
            `Supported input: ${SIZE_FINDER_CONFIG.supportedHeight.min}–${SIZE_FINDER_CONFIG.supportedHeight.max} cm and ${SIZE_FINDER_CONFIG.supportedWeight.min}–${SIZE_FINDER_CONFIG.supportedWeight.max} kg. We do not save these measurements.`,
            `المدى المدعوم: ${SIZE_FINDER_CONFIG.supportedHeight.min}–${SIZE_FINDER_CONFIG.supportedHeight.max} سم و${SIZE_FINDER_CONFIG.supportedWeight.min}–${SIZE_FINDER_CONFIG.supportedWeight.max} كجم. لا نحفظ هذه القياسات.`,
          )
        }}
      </p>

      <div v-if="result" class="size-finder__result" aria-live="polite">
        <template v-if="result.kind === 'recommended'">
          <span class="eyebrow">{{ t('YOUR KHT FIT', 'مقاس KHT المناسب لك') }}</span>
          <strong
            >{{ t('Best match', 'المقاس المناسب') }} <b>{{ result.size }}</b></strong
          >
          <p>
            {{
              t(
                `Based on your height and weight, size ${result.size} matches the KHT oversized fit guide. Compare the garment measurements for your preferred fit.`,
                `بناءً على طولك ووزنك، مقاس ${result.size} مناسب حسب دليل فيت KHT الأوفرسايز. قارن قياسات القطعة للفيت اللي تفضله.`,
              )
            }}
          </p>
          <button type="button" class="button button-dark" @click="emit('select', result.size)">
            {{ t(`Apply size ${result.size}`, `اختار مقاس ${result.size}`) }}
          </button>
        </template>
        <template v-else-if="result.kind === 'borderline'">
          <span class="eyebrow">{{ t('CHOOSE YOUR FIT', 'اختار الفيت المناسب') }}</span>
          <strong>{{ t('M or L — your choice', 'M أو L — اختار فيتك') }}</strong>
          <p>
            {{
              t(
                'Both sizes match your measurements. Choose M for a balanced oversized fit or L for a roomier fit, then compare the garment chart.',
                'المقاسين مناسبين لقياساتك. اختار M لأوفرسايز متوازن أو L لفيت أوسع، وقارن جدول قياسات القطعة.',
              )
            }}
          </p>
          <fieldset class="size-finder__preference">
            <legend>{{ t('Which fit do you prefer?', 'بتفضل أي فيت؟') }}</legend>
            <label
              ><input v-model="preference" type="radio" value="balanced" />{{
                t('Balanced oversized', 'أوفرسايز متوازن')
              }}</label
            >
            <label
              ><input v-model="preference" type="radio" value="extra" />{{
                t('Extra relaxed oversized', 'أوفرسايز أوسع')
              }}</label
            >
          </fieldset>
          <p v-if="preference" class="size-finder__preference-note">
            {{
              preference === 'balanced'
                ? t(
                    'M gives the more balanced oversized silhouette. Check the garment measurements before choosing it.',
                    'مقاس M يدي شكل أوفرسايز متوازن. قارن قياسات القطعة قبل اختياره.',
                  )
                : t(
                    'L gives a roomier oversized silhouette. Check the garment measurements before choosing it.',
                    'مقاس L يدي شكل أوفرسايز أوسع. قارن قياسات القطعة قبل اختياره.',
                  )
            }}
          </p>
        </template>
        <template v-else-if="result.kind === 'manual'">
          <span class="eyebrow">{{ t('LET’S CHECK THE FIT', 'خلّينا نراجع المقاس') }}</span>
          <strong>{{ t('Personal sizing help', 'مساعدة في اختيار المقاس') }}</strong>
          <p>
            {{
              result.reason === 'unavailable'
                ? t(
                    'Your matching size is currently unavailable. Check the size guide or ask us about the next restock.',
                    'المقاس المناسب غير متاح حاليًا. راجع دليل المقاسات أو اسألنا عن موعد توفره.',
                  )
                : t(
                    'For these measurements, compare the garment chart or send us your preferred fit and we will help you choose.',
                    'للقياسات دي، قارن جدول القطعة أو ابعتلنا الفيت اللي تفضله ونساعدك تختار.',
                  )
            }}
          </p>
        </template>
        <p v-else class="size-finder__error" role="alert">
          {{
            t(
              'Enter a height and weight within the supported range.',
              'اكتب طول ووزن داخل المدى المدعوم.',
            )
          }}
        </p>
      </div>

      <div class="size-finder__actions">
        <button type="button" class="remove-link" @click="emit('guide')">
          {{ t('Compare garment measurements', 'قارن مقاسات القطعة') }}
        </button>
        <a
          :href="assistanceUrl"
          :target="isExternalHelp ? '_blank' : undefined"
          :rel="isExternalHelp ? 'noopener noreferrer' : undefined"
          class="remove-link"
          >{{ t('Ask us for sizing help', 'اسألنا عن المقاس') }}</a
        >
      </div>
      <p class="size-finder__disclaimer">
        {{
          t(
            'The chart shows garment measurements. Compare them with a similar piece you own for the fit you like.',
            'الجدول يعرض قياسات القطعة نفسها. قارنها بقطعة عندك لتحصل على الفيت اللي بتحبه.',
          )
        }}
      </p>
    </div>
  </OverlayPanel>
</template>
