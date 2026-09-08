import type { CartLine, Catalog, Locale, Localized, Product } from '../../shared/types'
import type { CustomerUser } from '../../shared/account'
import type { SavedCart } from '../../shared/customerCart'

const cartQueues = new WeakMap<object, Promise<void>>()

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
  const app = useNuxtApp()
  const user = useState<CustomerUser | null>('customer-user', () => null)
  const saved = useState<SavedCart | null>('saved-cart', () => null)
  const syncError = useState('bag-sync-error', () => '')
  const syncing = useState('bag-syncing', () => false)
  const previousOwner = useCookie<string | null>('kht-bag-owner', {
    default: () => null,
    sameSite: 'lax',
    maxAge: 2592000,
  })
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
    const accountId = user.value?.id
    const prior = cartQueues.get(app) || Promise.resolve()
    syncing.value = true
    const next = prior.then(async () => {
      if (accountId) {
        if (!saved.value || user.value?.id !== accountId)
          throw new Error(
            t('Reload your account bag before editing.', 'أعد تحميل سلة حسابك قبل التعديل.'),
          )
        const result = await $fetch<SavedCart>('/api/cart', {
          method: 'PUT',
          body: { id: saved.value.id, version: saved.value.version, items },
        })
        saved.value = result
      } else {
        await $fetch('/api/cart/snapshot', {
          method: 'PUT',
          body: { cartId: cartId.value, items },
          keepalive: true,
        })
      }
      syncError.value = ''
    })
    cartQueues.set(app, next)
    void next
      .catch((cause) => {
        syncError.value =
          cause?.data?.statusMessage ||
          cause?.message ||
          t(
            'Your bag could not be saved. Retry before checkout.',
            'تعذر حفظ السلة. حاول مرة أخرى قبل إتمام الطلب.',
          )
      })
      .finally(() => {
        if (cartQueues.get(app) === next) syncing.value = false
      })
  }
  async function flush() {
    await (cartQueues.get(app) || Promise.resolve())
    if (syncError.value) throw new Error(syncError.value)
  }
  async function restore(mergeGuest = false) {
    // Finish guest writes before merging and never merge cached account contents as guest items.
    await (cartQueues.get(app) || Promise.resolve()).catch(() => undefined)
    cartQueues.delete(app)
    const guest = previousOwner.value ? [] : Array.isArray(raw.value) ? raw.value : []
    if (!user.value) {
      if (previousOwner.value) resetLocal()
      return
    }
    syncing.value = true
    try {
      const result = mergeGuest
        ? await $fetch<SavedCart>('/api/cart/merge', { method: 'POST', body: { items: guest } })
        : await $fetch<SavedCart>('/api/cart')
      saved.value = result
      raw.value = result.items
      previousOwner.value = user.value.id
      syncError.value = ''
      if (result.adjusted)
        announcement.value = t(
          'Your bags were combined. Quantities were checked against current availability.',
          'تم دمج السلتين ومراجعة الكميات حسب المخزون الحالي.',
        )
    } catch (cause: any) {
      syncError.value =
        cause?.data?.statusMessage ||
        t(
          'Your saved bag could not be loaded. Please retry.',
          'تعذر تحميل سلتك المحفوظة. حاول مرة أخرى.',
        )
      throw cause
    } finally {
      syncing.value = false
    }
  }
  function resetLocal() {
    raw.value = []
    saved.value = null
    previousOwner.value = null
    cartId.value = crypto.randomUUID()
    cartQueues.delete(app)
    syncError.value = ''
    open.value = false
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
  return {
    lines,
    count,
    total,
    open,
    announcement,
    add,
    update,
    clear,
    restore,
    flush,
    resetLocal,
    saved,
    syncError,
    syncing,
  }
}
