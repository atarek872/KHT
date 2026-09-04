<script setup lang="ts">
const { t } = useLanguage()
</script>
<template>
  <div class="size-guide-content">
    <p>
      {{
        t(
          'Our concept collection uses relaxed and oversized silhouettes. The table below illustrates body measurements in centimetres; final garment measurements are not yet available.',
          'المجموعة التصورية بقصّات واسعة ومريحة. الجدول مثال لقياسات الجسم بالسنتيمتر؛ قياسات القطع النهائية غير متاحة بعد.',
        )
      }}
    </p>
    <div class="table-scroll">
      <table>
        <caption>
          {{
            t('Illustrative body measurements (cm)', 'قياسات جسم توضيحية (سم)')
          }}
        </caption>
        <thead>
          <tr>
            <th>{{ t('Size', 'المقاس') }}</th>
            <th>{{ t('Chest', 'الصدر') }}</th>
            <th>{{ t('Waist', 'الوسط') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in [
              ['S', '88–94', '72–78'],
              ['M', '94–100', '78–84'],
              ['L', '100–106', '84–90'],
              ['XL', '106–112', '90–96'],
              ['XXL', '112–118', '96–102'],
            ]"
            :key="row[0]"
          >
            <th>{{ row[0] }}</th>
            <td dir="ltr">{{ row[1] }}</td>
            <td dir="ltr">{{ row[2] }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <h3>{{ t('How to measure', 'إزاي تاخد مقاسك') }}</h3>
    <p>
      <strong>{{ t('Chest:', 'الصدر:') }}</strong>
      {{
        t(
          'Measure around the fullest part, keeping the tape level.',
          'قيس محيط أوسع نقطة مع الحفاظ على شريط القياس مستقيم.',
        )
      }}
    </p>
    <p>
      <strong>{{ t('Waist:', 'الوسط:') }}</strong>
      {{
        t(
          'Measure around your natural waist without pulling the tape tight.',
          'قيس محيط وسطك الطبيعي من غير شد شريط القياس.',
        )
      }}
    </p>
    <p>
      {{
        t(
          'Tracksuit jackets and trousers share the selected size in this concept collection.',
          'الجاكيت والبنطلون في السوت بنفس المقاس المختار في المجموعة التصورية.',
        )
      }}
    </p>
  </div>
</template>
