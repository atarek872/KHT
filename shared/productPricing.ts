export function getDiscountPercentage(price: number, compareAtPrice?: number | null) {
  if (
    typeof compareAtPrice !== 'number'
    || !Number.isFinite(price)
    || !Number.isFinite(compareAtPrice)
    || compareAtPrice <= price
  ) return null
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
}
