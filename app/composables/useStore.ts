import type { CartLine, Catalog, Locale, Localized, Product } from '../../shared/types'

export function useLanguage() {
  const locale = useCookie<Locale>('kht-language', {
    default: () => 'en',
    sameSite: 'lax',
    maxAge: 31536000,
  })
  const t = (en: string, ar: string) => (locale.value === 'ar' ? ar : en)
  const localized = (value: Localized) => value[locale.value === 'ar' ? 'ar' : 'en']
  const money = (value: number) =>
    `${new Intl.NumberFormat('en-US').format(value)} ${t('EGP', 'ج.م')}`
  return { locale, t, localized, money }
}

export const useCatalog = () =>
  useState<Catalog>('catalog', () => ({ products: [], categories: [], demo: true }))

export function useBag() {
  const raw = useCookie<CartLine[]>('kht-bag', {
    default: () => [],
    sameSite: 'lax',
    maxAge: 604800,
    watch: true,
  })
  const sharedCartId = useState('kht-cart-id', () => crypto.randomUUID())
  const cartId = useCookie<string>('kht-cart-id', {
    default: () => sharedCartId.value,
    sameSite: 'lax',
    maxAge: 2592000,
  })
  const catalog = useCatalog()
  const open = useState('bag-open', () => false)
  const announcement = useState('bag-announcement', () => '')
  const { t } = useLanguage()
  const lines = computed(() =>
    (Array.isArray(raw.value) ? raw.value : []).flatMap((line) => {
      const product = catalog.value.products.find((p) => p.id === line?.id)
      if (
        !product ||
        !product.sizes.some((s) => s.name === line.size) ||
        !Number.isInteger(line.quantity) ||
        line.quantity < 1 ||
        line.quantity > 10
      )
        return []
      return [{ ...line, product }]
    }),
  )
  const count = computed(() => lines.value.reduce((sum, line) => sum + line.quantity, 0))
  const total = computed(() =>
    lines.value.reduce((sum, line) => sum + line.quantity * line.product.price, 0),
  )
  function track(items: CartLine[]) {
    if (!import.meta.client) return
    void $fetch('/api/cart/snapshot', {
      method: 'PUT',
      body: { cartId: cartId.value, items },
      keepalive: true,
    }).catch(() => undefined)
  }
  function add(product: Product, size: string) {
    const stock = product.sizes.find((s) => s.name === size)?.stock || 0
    const current = lines.value.find((l) => l.id === product.id && l.size === size)
    if ((current?.quantity || 0) >= Math.min(stock, 10)) return false
    const next = lines.value.map(({ id, size, quantity }) => ({ id, size, quantity }))
    if (current) next.find((l) => l.id === product.id && l.size === size)!.quantity++
    else if (next.length < 12) next.push({ id: product.id, size, quantity: 1 })
    else return false
    raw.value = next
    track(next)
    announcement.value = t('Added to your bag.', 'تمت الإضافة للسلة.')
    open.value = true
    return true
  }
  function update(id: string, size: string, quantity: number) {
    const next = lines.value.flatMap((line) => {
      if (line.id !== id || line.size !== size)
        return [{ id: line.id, size: line.size, quantity: line.quantity }]
      if (quantity <= 0) return []
      const stock = line.product.sizes.find((s) => s.name === size)?.stock || 0
      return [{ id, size, quantity: Math.min(quantity, stock, 10) }]
    })
    raw.value = next
    track(next)
    announcement.value = t('Bag updated.', 'تم تحديث السلة.')
  }
  function clear() {
    raw.value = []
    track([])
    open.value = false
  }
  return { lines, count, total, open, announcement, add, update, clear }
}
