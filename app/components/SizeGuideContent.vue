<script setup lang="ts">
const { t } = useLanguage()
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
          <tr>
            <th scope="row">M</th>
            <td>72</td>
            <td>67</td>
          </tr>
          <tr>
            <th scope="row">L</th>
            <td>76</td>
            <td>72</td>
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
          <tr>
            <th scope="row">M</th>
            <td>100</td>
            <td>52</td>
            <td>104</td>
          </tr>
          <tr>
            <th scope="row">L</th>
            <td>100</td>
            <td>56</td>
            <td>112</td>
          </tr>
        </tbody>
      </table>
    </div>

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
