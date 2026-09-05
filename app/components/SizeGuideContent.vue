<script setup lang="ts">
const { t } = useLanguage()
</script>
<template>
  <div class="size-guide-content">
    <p>
      {{
        t(
          'The KHT collection uses relaxed and oversized silhouettes. Use the body measurements below in centimetres and choose the larger size when you are between two sizes.',
          'مجموعة KHT بقصّات واسعة ومريحة. استخدم قياسات الجسم بالسنتيمتر، ولو قياسك بين مقاسين اختار المقاس الأكبر.',
        )
      }}
    </p>
    <div class="table-scroll">
      <table>
        <caption>
          {{
            t('Body measurements (cm)', 'قياسات الجسم (سم)')
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
          'Tracksuit jackets and trousers share the selected size unless the product page states otherwise.',
          'الجاكيت والبنطلون في السوت بنفس المقاس المختار إلا لو صفحة المنتج موضحة غير كده.',
        )
      }}
    </p>
  </div>
</template>
