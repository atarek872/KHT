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
            'A starting point for the KHT oversized hoodie and wide-leg pants set. Enter your height and weight; compare the garment measurements before you choose.',
            'نقطة بداية لاختيار مقاس طقم KHT الأوفرسايز. اكتب طولك ووزنك، وقارن مقاسات القطعة قبل ما تختار.',
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
          <span class="eyebrow">{{ t('YOUR SIZE STARTING POINT', 'المقاس الأقرب لك') }}</span>
          <strong
            >{{ t('Recommended size', 'المقاس المقترح') }} <b>{{ result.size }}</b></strong
          >
          <p>
            {{
              t(
                `Your height and weight fall within the initial range for size ${result.size}. This is an estimate for KHT’s oversized fit, not a guarantee of fit.`,
                `طولك ووزنك داخل النطاق المبدئي لمقاس ${result.size}. ده تقدير لفيت KHT الأوفرسايز، مش ضمان للمقاس.`,
              )
            }}
          </p>
          <button type="button" class="button button-dark" @click="emit('select', result.size)">
            {{ t(`Apply size ${result.size}`, `اختار مقاس ${result.size}`) }}
          </button>
        </template>
        <template v-else-if="result.kind === 'borderline'">
          <span class="eyebrow">{{ t('TWO POSSIBLE FITS', 'مقاسين محتملين') }}</span>
          <strong>{{ t('M or L may work', 'M أو L ممكن يناسبك') }}</strong>
          <p>
            {{
              t(
                'Your measurements overlap or sit close to both estimated ranges. Compare the garment chart and choose the fit you prefer; no size has been selected for you.',
                'مقاساتك متداخلة أو قريبة من نطاق المقاسين. قارن جدول القطعة واختار الفيت اللي بتحبه؛ مش هنحدد المقاس بدلًا منك.',
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
                    'M may give a more balanced silhouette. Check both garment measurements before choosing it.',
                    'مقاس M ممكن يدي شكل أوفرسايز متوازن. قارن قياسات القطعتين قبل اختياره.',
                  )
                : t(
                    'L may give a roomier silhouette. Check both garment measurements before choosing it.',
                    'مقاس L ممكن يدي شكل أوسع. قارن قياسات القطعتين قبل اختياره.',
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
                    'The size suggested by these estimates is currently unavailable, or one of two plausible sizes is unavailable. Please check the size guide or ask us before ordering.',
                    'المقاس الأقرب بالتقدير غير متاح حاليًا، أو واحد من المقاسين المحتملين غير متاح. راجع جدول المقاسات أو اسألنا قبل الطلب.',
                  )
                : t(
                    'Height and weight alone cannot give a confident suggestion for these measurements. Ask us for help and compare a similar garment.',
                    'الطول والوزن وحدهم مش كفاية علشان نرشح مقاس بثقة في الحالة دي. تواصل معانا وقارن بقطعة مشابهة.',
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
            'Initial height and weight ranges are estimates, not tested fit data. Garment widths and lengths describe the clothing, not your body. The listed pants waist is not a measured relaxed or maximum elastic waist.',
            'نطاقات الطول والوزن تقديرية ولم تُختبر على العملاء بعد. عرض وطول القطعة قياسات للملابس مش للجسم. قياس وسط البنطلون المعروض ليس قياس الأستك مرتاحًا أو عند أقصى تمدد.',
          )
        }}
      </p>
    </div>
  </OverlayPanel>
</template>
