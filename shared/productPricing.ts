import type { Product } from './types'

export function sizePrice(product: Product, size: string) {
  return product.sizes.find((variant) => variant.name === size)?.price ?? product.price
}

export function startingPrice(product: Product) {
  const available = product.sizes.filter((variant) => variant.stock > 0)
  const sizes = available.length ? available : product.sizes
  return sizes.length ? Math.min(...sizes.map((variant) => variant.price ?? product.price)) : product.price
}

export function hasSizePriceRange(product: Product) {
  const available = product.sizes.filter((variant) => variant.stock > 0)
  return new Set(available.map((variant) => variant.price ?? product.price)).size > 1
}

export function getDiscountPercentage(price: number, compareAtPrice?: number | null) {
  if (
    typeof compareAtPrice !== 'number'
    || !Number.isFinite(price)
    || !Number.isFinite(compareAtPrice)
    || compareAtPrice <= price
  ) return null
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
}
