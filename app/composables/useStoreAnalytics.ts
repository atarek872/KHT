import type { CartLine, Product } from '../../shared/types'
import { sizePrice, startingPrice } from '#shared/productPricing'
import {
  metaCartPayload,
  metaProductPayload,
  metaPurchasePayload,
  safeMetaSearchTerm,
} from '#shared/metaCommerce'

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
    price: size ? sizePrice(product, size) : startingPrice(product),
    ...(discount > 0 ? { discount } : {}),
    quantity,
  }
}

export function useStoreAnalytics() {
  const config = useRuntimeConfig().public
  const googleEnabled = /^G-[A-Z0-9]+$/.test(String(config.googleTagId || ''))
  const metaEnabled = /^\d{10,20}$/.test(String(config.metaPixelId || ''))

  function send(event: AnalyticsEvent, parameters: Record<string, unknown>) {
    if (!import.meta.client || !googleEnabled) return false
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag
    if (typeof gtag !== 'function') return false
    gtag('event', event, parameters)
    return true
  }

  function sendMeta(event: string, parameters: Record<string, unknown>, eventId?: string) {
    if (!import.meta.client || !metaEnabled) return false
    const fbq = (window as Window & { fbq?: (...args: unknown[]) => void }).fbq
    if (typeof fbq !== 'function') return false
    if (eventId) fbq('track', event, parameters, { eventID: eventId })
    else fbq('track', event, parameters)
    return true
  }

  function trackViewItem(product: Product) {
    const googleSent = send('view_item', {
      currency: 'EGP',
      value: startingPrice(product),
      items: [analyticsItem(product)],
    })
    return sendMeta('ViewContent', metaProductPayload(product)) || googleSent
  }

  function trackAddToCart(product: Product, size: string) {
    const googleSent = send('add_to_cart', {
      currency: 'EGP',
      value: sizePrice(product, size),
      items: [analyticsItem(product, size)],
    })
    return sendMeta('AddToCart', metaProductPayload(product, size)) || googleSent
  }

  function trackBeginCheckout(items: AnalyticsLine[], value: number, coupon?: string) {
    const googleSent = send('begin_checkout', {
      currency: 'EGP',
      value,
      ...(coupon ? { coupon } : {}),
      items: items.map((line) => analyticsItem(line.product, line.size, line.quantity)),
    })
    return sendMeta('InitiateCheckout', metaCartPayload(items, value)) || googleSent
  }

  function trackPurchase(order: PurchaseEvent) {
    const merchandiseValue = Math.max(0, order.value - order.shipping)
    const subtotal = order.items.reduce(
      (sum, line) => sum + sizePrice(line.product, line.size) * line.quantity,
      0,
    )
    const googleSent = send('purchase', {
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
          subtotal > 0 ? (order.discount * sizePrice(line.product, line.size)) / subtotal : 0,
        ),
      ),
    })
    const key = `kht-meta-purchase:${order.transactionId}`
    try {
      if (sessionStorage.getItem(key)) return googleSent
    } catch {
      // Private browsing can disable session storage; the order ID still identifies the event.
    }
    const metaSent = sendMeta(
      'Purchase',
      metaPurchasePayload(order.items, order.value, order.transactionId),
      order.transactionId,
    )
    if (metaSent) {
      try {
        sessionStorage.setItem(key, '1')
      } catch {
        // Tracking remains functional when session storage is unavailable.
      }
    }
    return metaSent || googleSent
  }

  function trackSearch(query: string) {
    const term = safeMetaSearchTerm(query)
    if (!term) return false
    return sendMeta('Search', { search_string: term })
  }

  function trackCompleteRegistration() {
    return sendMeta('CompleteRegistration', { status: 'completed' })
  }

  return {
    trackViewItem,
    trackAddToCart,
    trackBeginCheckout,
    trackPurchase,
    trackSearch,
    trackCompleteRegistration,
  }
}
