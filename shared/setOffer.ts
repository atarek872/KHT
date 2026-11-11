import type { CartLine, Catalog } from './types.ts'
import { sizePrice } from './productPricing.ts'
import { DEFAULT_HOME_SHOPPING } from './storeContent.ts'

function setPieces(catalog: Catalog) {
  const piece = (id: string) =>
    catalog.products.find(
      (product) =>
        product.slug === DEFAULT_HOME_SHOPPING.cards.find((card) => card.id === id)?.productSlug,
    )
  return { set: piece('full-look'), hoodie: piece('hoodie'), pants: piece('pants') }
}

export function fullSetDiscountPercent(catalog: Catalog, selectedSize?: string) {
  const { set, hoodie, pants } = setPieces(catalog)
  if (!set || !hoodie || !pants) return 0
  const sizes = set.sizes.filter(
    (size) =>
      size.stock > 0 &&
      hoodie.sizes.some((part) => part.name === size.name) &&
      pants.sizes.some((part) => part.name === size.name) &&
      (!selectedSize || size.name === selectedSize),
  )
  if (!sizes.length) return 0
  const percentages = sizes.map((size) => {
    const separate = sizePrice(hoodie, size.name) + sizePrice(pants, size.name)
    return separate > 0 ? Math.max(0, (1 - sizePrice(set, size.name) / separate) * 100) : 0
  })
  return Math.round(Math.min(...percentages))
}

export function setSavingsForLines(catalog: Catalog, lines: CartLine[]) {
  const { set, hoodie, pants } = setPieces(catalog)
  if (!set || !hoodie || !pants) return 0
  return lines.reduce((total, line) => {
    if (
      line.id !== set.id ||
      !hoodie.sizes.some((size) => size.name === line.size) ||
      !pants.sizes.some((size) => size.name === line.size)
    )
      return total
    const saving =
      sizePrice(hoodie, line.size) + sizePrice(pants, line.size) - sizePrice(set, line.size)
    return total + Math.max(0, saving) * line.quantity
  }, 0)
}
