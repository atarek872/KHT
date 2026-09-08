import type { CustomerUser } from '../../shared/account'

export function useCustomer() {
  const user = useState<CustomerUser | null>('customer-user', () => null)
  const request = useRequestFetch()
  async function refresh() {
    const result = await request<{ user: CustomerUser | null }>('/api/account/session')
    user.value = result.user
    return user.value
  }
  async function authenticate(mode: 'login' | 'register', body: Record<string, string>) {
    const result = await $fetch<{ user: CustomerUser }>(`/api/account/${mode}`, {
      method: 'POST',
      body,
    })
    user.value = result.user
    await useBag().restore(true)
  }
  async function logout() {
    const bag = useBag()
    await bag.flush()
    await $fetch('/api/account/logout', { method: 'POST' })
    bag.resetLocal()
    user.value = null
    clearNuxtData((key) => key.startsWith('customer-'))
    await navigateTo('/account/login')
  }
  return { user, refresh, authenticate, logout }
}

export function customerReturnTo(value: unknown) {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !/[\\\r\n]/.test(value)
    ? value
    : '/account'
}

export function customerError(cause: unknown) {
  const { t } = useLanguage()
  const error = cause as { data?: { statusMessage?: string }; statusCode?: number }
  return (
    error.data?.statusMessage ||
    t('Unable to save. Please try again.', 'تعذر الحفظ. يرجى المحاولة مرة أخرى.')
  )
}

export function customerStatus(status: string) {
  const { t } = useLanguage()
  const labels: Record<string, [string, string]> = {
    pending: ['Order placed', 'تم الطلب'],
    confirmed: ['Confirmed', 'مؤكد'],
    processing: ['Preparing your order', 'جاري تجهيز طلبك'],
    shipped: ['Shipped', 'تم الشحن'],
    'out-for-delivery': ['Out for delivery', 'خرج للتوصيل'],
    delivered: ['Delivered', 'تم التوصيل'],
    cancelled: ['Cancelled', 'ملغي'],
    returned: ['Returned', 'مرتجع'],
    paid: ['Paid', 'مدفوع'],
    refunded: ['Refunded', 'تم الاسترداد'],
    failed: ['Failed', 'فشل'],
    unpaid: ['Unpaid', 'غير مدفوع'],
    cod: ['Cash on delivery', 'الدفع عند الاستلام'],
    cash_on_delivery: ['Cash on delivery', 'الدفع عند الاستلام'],
    card: ['Card', 'بطاقة'],
    instapay: ['InstaPay', 'إنستاباي'],
    vodafone_cash: ['Vodafone Cash', 'فودافون كاش'],
  }
  const value = labels[status]
  return value ? t(...value) : status
}
