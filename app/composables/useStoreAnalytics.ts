import type { CartLine, Product } from '../../shared/types'
import { sizePrice, startingPrice } from '#shared/productPricing'
import { sendOnce } from '#shared/analyticsOnce'
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
  const { locale } = useLanguage()
  const { attribution } = useCampaignAttribution()
  const googleEnabled = /^G-[A-Z0-9]+$/.test(String(config.googleTagId || ''))
  const metaEnabled = /^\d{10,20}$/.test(String(config.metaPixelId || ''))

  function send(event: AnalyticsEvent, parameters: Record<string, unknown>) {
    if (!import.meta.client || !googleEnabled) return false
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag
    if (typeof gtag !== 'function') return false
    let debugMode = false
    try {
      if (new URLSearchParams(location.search).get('analytics_debug') === '1') {
        sessionStorage.setItem('kht-analytics-debug', '1')
      }
      debugMode = sessionStorage.getItem('kht-analytics-debug') === '1'
    } catch {
      // Analytics still works when storage is unavailable.
    }
    gtag('event', event, {
      ...parameters,
      language: locale.value,
      ...(debugMode ? { debug_mode: true } : {}),
      ...(attribution.value?.source
        ? { source_campaign: attribution.value.source, campaign_name: attribution.value.campaign }
        : {}),
    })
    return true
  }

  function sendMeta(event: string, parameters: Record<string, unknown>, eventId?: string) {
    if (!import.meta.client || !metaEnabled) return false
    const fbq = (window as Window & { fbq?: (...args: unknown[]) => void }).fbq
    if (typeof fbq !== 'function') return false
    fbq(
      'track',
      event,
      {
        ...parameters,
        language: locale.value,
        ...(attribution.value?.source
          ? { source_campaign: attribution.value.source, campaign_name: attribution.value.campaign }
          : {}),
      },
      { eventID: eventId || crypto.randomUUID() },
    )
    return true
  }

  function sendCommerceMeta(
    eventName: 'ViewContent' | 'AddToCart' | 'InitiateCheckout',
    parameters: Record<string, unknown>,
    details: Record<string, unknown>,
  ) {
    if (!import.meta.client) return false
    const eventId = crypto.randomUUID()
    const pixelSent = sendMeta(eventName, parameters, eventId)
    let testCode = ''
    try {
      const queryCode = new URLSearchParams(location.search).get('meta_test') || ''
      if (/^TEST[0-9A-Za-z]{4,20}$/.test(queryCode))
        sessionStorage.setItem('kht-meta-test-code', queryCode)
      testCode = sessionStorage.getItem('kht-meta-test-code') || ''
    } catch {
      // Analytics still works when storage is unavailable.
    }
    void $fetch('/api/analytics/meta', {
      method: 'POST',
      ...(testCode ? { headers: { 'x-kht-meta-test-code': testCode } } : {}),
      body: {
        eventName,
        eventId,
        path: location.pathname,
        attribution: attribution.value,
        ...details,
      },
    }).catch(() => undefined)
    return pixelSent
  }

  function trackViewItem(product: Product) {
    const googleSent = send('view_item', {
      currency: 'EGP',
      value: startingPrice(product),
      items: [analyticsItem(product)],
    })
    return (
      sendCommerceMeta('ViewContent', metaProductPayload(product), { productId: product.id }) ||
      googleSent
    )
  }

  function trackAddToCart(product: Product, size: string) {
    const googleSent = send('add_to_cart', {
      currency: 'EGP',
      value: sizePrice(product, size),
      items: [analyticsItem(product, size)],
    })
    return (
      sendCommerceMeta('AddToCart', metaProductPayload(product, size), {
        productId: product.id,
        size,
      }) || googleSent
    )
  }

  function trackBeginCheckout(items: AnalyticsLine[], value: number, coupon?: string) {
    const googleSent = send('begin_checkout', {
      currency: 'EGP',
      value,
      ...(coupon ? { coupon } : {}),
      items: items.map((line) => analyticsItem(line.product, line.size, line.quantity)),
    })
    return (
      sendCommerceMeta('InitiateCheckout', metaCartPayload(items, value), {
        items: items.map(({ id, size, quantity }) => ({ id, size, quantity })),
      }) || googleSent
    )
  }

  function trackPurchase(order: PurchaseEvent) {
    if (!import.meta.client) return false
    let storage: Storage | undefined
    try {
      storage = sessionStorage
    } catch {
      /* Private browsing can block it. */
    }
    return sendOnce(
      `kht-purchase:${order.transactionId}`,
      () => {
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
        const metaSent = sendMeta(
          'Purchase',
          metaPurchasePayload(order.items, merchandiseValue, order.transactionId),
          order.transactionId,
        )
        return metaSent || googleSent
      },
      storage,
    )
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
