<script setup lang="ts">
import { SIZE_FINDER_CONFIG, type KhtSetSize } from '#shared/sizeRecommendation'
const { t } = useLanguage()
const sizes: KhtSetSize[] = ['M', 'L']
</script>
<template>
  <div class="size-guide-content">
    <p>
      {{
        t(
          'These are the actual garment measurements in centimetres, not body measurements. Lay a similar piece flat to compare before choosing your size.',
          'دي مقاسات القطعة الفعلية بالسنتيمتر، مش مقاسات الجسم. افرد قطعة مشابهة وقارن مقاساتها قبل ما تختار.',
        )
      }}
    </p>

    <div class="table-scroll">
      <table>
        <caption>
          {{
            t('Hoodie measurements (cm)', 'مقاسات الهودي (سم)')
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ t('Size', 'المقاس') }}</th>
            <th scope="col">{{ t('Length', 'الطول') }}</th>
            <th scope="col">{{ t('Width (laid flat)', 'العرض (مفرود)') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="size in sizes" :key="size">
            <th scope="row">{{ size }}</th>
            <td>{{ SIZE_FINDER_CONFIG.sizes[size].garment.hoodieLengthCm }}</td>
            <td>{{ SIZE_FINDER_CONFIG.sizes[size].garment.hoodieFlatWidthCm }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="table-scroll">
      <table>
        <caption>
          {{
            t('Pants measurements (cm)', 'مقاسات البنطلون (سم)')
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ t('Size', 'المقاس') }}</th>
            <th scope="col">{{ t('Length', 'الطول') }}</th>
            <th scope="col">{{ t('Half waist width (laid flat)', 'نصف عرض الوسط (مفرود)') }}</th>
            <th scope="col">{{ t('Waist circumference', 'محيط الوسط') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="size in sizes" :key="size">
            <th scope="row">{{ size }}</th>
            <td>{{ SIZE_FINDER_CONFIG.sizes[size].garment.pantsLengthCm }}</td>
            <td>
              {{ SIZE_FINDER_CONFIG.sizes[size].garment.listedPantsWaistCircumferenceCm / 2 }}
            </td>
            <td>{{ SIZE_FINDER_CONFIG.sizes[size].garment.listedPantsWaistCircumferenceCm }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p>
      {{
        t(
          'The listed pants waist is a garment measurement; it does not identify the relaxed elastic waist or maximum stretch.',
          'مقاس وسط البنطلون المعروض مقاس للقطعة، وليس قياس الوسط في وضع الأستك المرتاح أو أقصى تمدد له.',
        )
      }}
    </p>

    <p>
      {{
        t(
          'For a set, compare both pieces in the same selected size.',
          'لو بتختار طقم، قارن مقاسات القطعتين على نفس المقاس المختار.',
        )
      }}
    </p>
  </div>
</template>
