import type { Product, Category } from '../../shared/types'

const aliases: Record<string, string> = {
  tees: 't shirt t shirts tshirt tshirts tee tees تيشرت تيشرتات تي شيرت',
  sets: 'tracksuit tracksuits track suit tracksuits set sets سوت سويت سوتات',
  pants: 'trouser trousers pant pants بنطلون بناطيل',
}
const normalize = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

export function matchesProduct(product: Product, query: string, categories: Category[] = []) {
  const category = categories.find((item) => item.slug === product.category)
  const haystack = normalize(
    [
      product.name.en,
      product.name.ar,
      product.category,
      product.description.en,
      product.description.ar,
      category?.name.en,
      category?.name.ar,
      aliases[product.category],
    ]
      .filter(Boolean)
      .join(' '),
  )
  return normalize(query)
    .split(' ')
    .every((term) => haystack.includes(term))
}
