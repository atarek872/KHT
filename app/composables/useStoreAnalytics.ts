import type { CartLine, Product } from '../../shared/types'

type AnalyticsLine = CartLine & { product: Product }
type AnalyticsEvent = 'view_item' | 'add_to_cart' | 'begin_checkout' | 'purchase'

interface PurchaseEvent {
  transactionId: string
  value: number
  shipping: number
  discount: number
  coupon?: string
  items: AnalyticsLine[]
}

function analyticsItem(product: Product, size?: string, quantity = 1, discount = 0) {
  return {
    item_id: product.code || product.id,
    item_name: product.name.en,
    item_brand: 'KHT',
    item_category: product.category,
    ...(size ? { item_variant: `Black / White / ${size}` } : {}),
    price: product.price,
    ...(discount > 0 ? { discount } : {}),
    quantity,
  }
}

export function useStoreAnalytics() {
  const configuredId = String(useRuntimeConfig().public.googleTagId || '')
  const enabled = /^G-[A-Z0-9]+$/.test(configuredId)

  function send(event: AnalyticsEvent, parameters: Record<string, unknown>) {
    if (!import.meta.client || !enabled) return false
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag
    if (typeof gtag !== 'function') return false
    gtag('event', event, parameters)
    return true
  }

  function trackViewItem(product: Product) {
    return send('view_item', {
      currency: 'EGP',
      value: product.price,
      items: [analyticsItem(product)],
    })
  }

  function trackAddToCart(product: Product, size: string) {
    return send('add_to_cart', {
      currency: 'EGP',
      value: product.price,
      items: [analyticsItem(product, size)],
    })
  }

  function trackBeginCheckout(items: AnalyticsLine[], value: number, coupon?: string) {
    return send('begin_checkout', {
      currency: 'EGP',
      value,
      ...(coupon ? { coupon } : {}),
      items: items.map((line) => analyticsItem(line.product, line.size, line.quantity)),
    })
  }

  function trackPurchase(order: PurchaseEvent) {
    const merchandiseValue = Math.max(0, order.value - order.shipping)
    const subtotal = order.items.reduce(
      (sum, line) => sum + line.product.price * line.quantity,
      0,
    )
    return send('purchase', {
      transaction_id: order.transactionId,
      currency: 'EGP',
      value: merchandiseValue,
      shipping: order.shipping,
      ...(order.coupon ? { coupon: order.coupon } : {}),
      items: order.items.map((line) =>
        analyticsItem(
          line.product,
          line.size,
          line.quantity,
          subtotal > 0 ? (order.discount * line.product.price) / subtotal : 0,
        ),
      ),
    })
  }

  return { trackViewItem, trackAddToCart, trackBeginCheckout, trackPurchase }
}
