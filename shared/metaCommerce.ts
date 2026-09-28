import type { CartLine, Product } from './types.ts'
import { sizePrice, startingPrice } from './productPricing.ts'

type AnalyticsLine = CartLine & { product: Product }

function contentId(product: Product) {
  return product.code || product.id
}

export function metaProductPayload(product: Product, size?: string) {
  const id = contentId(product)
  const value = size ? sizePrice(product, size) : startingPrice(product)
  return {
    content_ids: [id],
    content_type: 'product',
    content_name: product.name.en,
    content_category: product.category,
    contents: [{ id, quantity: 1, item_price: value }],
    currency: 'EGP',
    value,
  }
}

export function metaCartPayload(lines: AnalyticsLine[], value: number) {
  return {
    content_ids: [...new Set(lines.map((line) => contentId(line.product)))],
    content_type: 'product',
    contents: lines.map((line) => ({
      id: contentId(line.product),
      quantity: line.quantity,
      item_price: sizePrice(line.product, line.size),
    })),
    num_items: lines.reduce((sum, line) => sum + line.quantity, 0),
    currency: 'EGP',
    value,
  }
}

export function metaPurchasePayload(lines: AnalyticsLine[], value: number, orderId: string) {
  return { ...metaCartPayload(lines, value), order_id: orderId }
}

export function safeMetaSearchTerm(query: string): string | null {
  const term = query.trim().slice(0, 100)
  if (!term || term.includes('@') || /(?:\d[\s+()-]*){7,}/.test(term)) return null
  return term
}
