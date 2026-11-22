<script setup lang="ts">
import type { DashboardRange, DashboardSnapshot } from '../../../shared/dashboard'
import DashboardMetric from '../../components/admin/dashboard/DashboardMetric.vue'
import DashboardSectionState from '../../components/admin/dashboard/DashboardSectionState.vue'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'لوحة المتجر — KHT Admin', robots: 'noindex, nofollow' })

const range = ref<DashboardRange>('7d')
const { data, error, status, refresh } = await useFetch<DashboardSnapshot>('/api/admin/dashboard', {
  query: { range },
  watch: [range],
})

let refreshTimer: ReturnType<typeof setInterval> | undefined
function refreshIfVisible() {
  if (document.visibilityState === 'visible') void refresh()
}
onMounted(() => {
  refreshTimer = setInterval(refreshIfVisible, 300000)
  document.addEventListener('visibilitychange', refreshIfVisible)
})
onBeforeUnmount(() => {
  clearInterval(refreshTimer)
  document.removeEventListener('visibilitychange', refreshIfVisible)
})

const ranges: { label: string; value: DashboardRange }[] = [
  { label: 'اليوم', value: 'today' },
  { label: '٧ أيام', value: '7d' },
  { label: '٣٠ يومًا', value: '30d' },
]

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(value)
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('ar-EG', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  )
const statusLabels: Record<string, string> = {
  pending: 'بانتظار التأكيد',
  confirmed: 'تم التأكيد',
  processing: 'قيد التجهيز',
  shipped: 'تم الشحن',
  'out-for-delivery': 'خرج للتوصيل',
  delivered: 'تم التسليم',
  cancelled: 'ملغى',
  returned: 'مرتجع',
}
const sourceLabels: Record<string, string> = {
  website: 'الموقع',
  instagram: 'إنستجرام',
  facebook: 'فيسبوك',
  tiktok: 'تيك توك',
  whatsapp: 'واتساب',
  phone: 'هاتف',
  admin: 'طلب أضافه المدير',
  other: 'مصدر آخر',
}
const maxSales = computed(() =>
  Math.max(1, ...(data.value?.salesTrend.items.map((item) => item.sales) || [])),
)
</script>

<template>
  <div class="admin-shell__page admin-dashboard" dir="rtl">
    <AdminPageHeader
      eyebrow="KHT / إدارة المتجر"
      title="لوحة المتجر"
      description="الطلبات والتحصيل والمخزون، مع أولويات واضحة للعمل."
    >
      <template #actions>
        <div class="admin-dashboard__ranges" role="group" aria-label="فترة الإحصائيات">
          <button
            v-for="option in ranges"
            :key="option.value"
            type="button"
            :aria-pressed="range === option.value"
            @click="range = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </template>
    </AdminPageHeader>

    <div v-if="status === 'pending' && !data" class="admin-dashboard__loading" role="status">
      <AdminLoader label="جارٍ تحميل الإحصائيات" />
      <div class="admin-dashboard__loading-grid" aria-hidden="true">
        <span v-for="index in 14" :key="index" />
      </div>
    </div>

    <AdminEmptyState
      v-else-if="error"
      title="تعذّر تحميل لوحة المتجر"
      description="تأكد من الاتصال ثم حاول مرة أخرى."
    >
      <template #actions>
        <AdminButton
          :loading="status === 'pending'"
          loading-label="جارٍ المحاولة"
          @click="refresh()"
        >
          إعادة المحاولة
        </AdminButton>
      </template>
    </AdminEmptyState>

    <template v-else-if="data">
      <section class="admin-dashboard__overview" aria-labelledby="dashboard-overview-title">
        <div class="admin-dashboard__section-heading">
          <div>
            <h2 id="dashboard-overview-title">نظرة عامة</h2>
            <p>
              الأرقام تخص {{ ranges.find((option) => option.value === data?.range)?.label }} · آخر
              تحديث
              {{
                new Intl.DateTimeFormat('ar-EG', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                  timeZone: 'Africa/Cairo',
                }).format(new Date(data.generatedAt))
              }}
            </p>
          </div>
          <AdminLoader v-if="status === 'pending'" label="جارٍ التحديث" />
        </div>
        <div class="admin-dashboard__metrics">
          <DashboardMetric v-for="metric in data.metrics" :key="metric.key" :metric="metric" />
        </div>
      </section>

      <div class="admin-dashboard__insights">
        <AdminSection title="أولويات العمل" description="خطوات مقترحة بناءً على الأرقام الحالية.">
          <div v-if="data.priorities.length" class="admin-dashboard__priority-list">
            <NuxtLink
              v-for="priority in data.priorities"
              :key="priority.key"
              :to="priority.to"
              class="admin-dashboard__priority"
            >
              <strong>{{ priority.count }}</strong>
              <span
                ><b>{{ priority.title }}</b
                ><small>{{ priority.detail }}</small></span
              >
              <span aria-hidden="true">←</span>
            </NuxtLink>
          </div>
          <p v-else class="admin-dashboard__quiet">
            لا توجد طلبات معلقة أو مقاسات قليلة أو سلات تحتاج متابعة في العرض الحالي.
          </p>
        </AdminSection>
        <AdminSection
          title="تقدير قيمة الطلبات المدفوعة"
          description="توقع مبسط للأيام السبعة القادمة، وليس مبيعات مؤكدة."
        >
          <div class="admin-dashboard__forecast">
            <strong v-if="data.forecast.value !== null" dir="ltr">{{
              formatCurrency(data.forecast.value)
            }}</strong>
            <strong v-else>بيانات غير كافية</strong>
            <p>{{ data.forecast.method }}</p>
          </div>
        </AdminSection>
      </div>

      <AdminSection
        title="مصادر الطلبات"
        description="المصدر المسجل لكل طلب، مع عدد الطلبات وقيمة ما دُفع منها. لا يقيس زيارات الإعلان."
      >
        <div v-if="data.sourcePerformance.items.length" class="admin-dashboard__sources">
          <div
            v-for="source in data.sourcePerformance.items"
            :key="source.source"
            class="admin-dashboard__source"
          >
            <strong>{{ sourceLabels[source.source] || source.source }}</strong>
            <span>{{ source.orders }} طلب</span>
            <small
              >مدفوع: <b dir="ltr">{{ formatCurrency(source.paidValue) }}</b></small
            >
          </div>
        </div>
        <DashboardSectionState
          v-else
          :availability="data.sourcePerformance.availability"
          :message="data.sourcePerformance.message"
        />
      </AdminSection>

      <div class="admin-dashboard__primary-grid">
        <AdminSection
          title="اتجاه الطلبات المدفوعة"
          description="قيمة الطلبات المدفوعة حسب يوم إنشائها، شاملة الشحن."
        >
          <ol v-if="data.salesTrend.items.length" class="admin-dashboard__data-list">
            <li v-for="item in data.salesTrend.items" :key="item.date">
              <time :datetime="item.date">{{ formatDate(item.date) }}</time>
              <span
                class="admin-dashboard__sales-bar"
                :style="{ '--bar-width': `${Math.max(2, (item.sales / maxSales) * 100)}%` }"
                aria-hidden="true"
              />
              <strong dir="ltr">{{ formatCurrency(item.sales) }}</strong>
            </li>
          </ol>
          <DashboardSectionState
            v-else
            :availability="data.salesTrend.availability"
            :message="data.salesTrend.message"
          />
        </AdminSection>

        <AdminSection
          title="أحدث الطلبات"
          description="آخر الطلبات المسجلة في الفترة، ويمكن فتح تفاصيل أي طلب."
        >
          <div v-if="data.recentOrders.items.length" class="admin-dashboard__data-list">
            <NuxtLink
              v-for="order in data.recentOrders.items"
              :key="order.id"
              :to="`/admin/orders/${order.id}`"
            >
              <span>
                <strong>{{ order.number }}</strong>
                <small
                  >{{ order.customerName }} ·
                  {{ statusLabels[order.fulfillmentStatus] || order.fulfillmentStatus }}</small
                >
              </span>
              <strong dir="ltr">{{ formatCurrency(order.total) }}</strong>
            </NuxtLink>
          </div>
          <DashboardSectionState
            v-else
            :availability="data.recentOrders.availability"
            :message="data.recentOrders.message"
          />
        </AdminSection>
      </div>

      <div class="admin-dashboard__secondary-grid">
        <AdminSection
          title="المنتجات الأكثر بيعًا"
          description="مرتبة بعدد القطع في الطلبات المدفوعة."
        >
          <ol v-if="data.topProducts.items.length" class="admin-dashboard__data-list">
            <li v-for="product in data.topProducts.items" :key="product.productName">
              <span>
                <strong>{{ product.productName }}</strong>
                <small>{{ product.quantity }} قطعة مدفوعة</small>
              </span>
              <strong dir="ltr">{{ formatCurrency(product.revenue) }}</strong>
            </li>
          </ol>
          <DashboardSectionState
            v-else
            :availability="data.topProducts.availability"
            :message="data.topProducts.message"
          />
        </AdminSection>

        <AdminSection
          title="المخزون القليل"
          description="أول خمسة مقاسات متبقي منها قطع قليلة؛ الرقم بالأعلى يشمل كل المقاسات."
        >
          <div v-if="data.lowStock.items.length" class="admin-dashboard__data-list">
            <NuxtLink
              v-for="variant in data.lowStock.items"
              :key="variant.id"
              to="/admin/inventory"
            >
              <span>
                <strong>{{ variant.productName }}</strong>
                <small>{{ variant.color }} / {{ variant.size }} · {{ variant.sku }}</small>
              </span>
              <strong>{{ variant.stock }} متبقية</strong>
            </NuxtLink>
          </div>
          <DashboardSectionState
            v-else
            :availability="data.lowStock.availability"
            :message="data.lowStock.message"
          />
        </AdminSection>

        <AdminSection title="السلات المتروكة" description="أحدث السلات التي توقفت قبل إتمام الطلب.">
          <div v-if="data.abandonedCarts.items.length" class="admin-dashboard__cart-list">
            <NuxtLink
              v-for="cart in data.abandonedCarts.items"
              :key="cart.id"
              :to="`/admin/abandoned-carts/${cart.id}`"
            >
              <span>{{ cart.customerName || 'زائر بدون اسم' }}</span>
              <strong>{{ cart.itemsCount }} قطعة</strong>
            </NuxtLink>
          </div>
          <DashboardSectionState
            v-else
            :availability="data.abandonedCarts.availability"
            :message="data.abandonedCarts.message"
          />
        </AdminSection>
      </div>
    </template>
  </div>
</template>
