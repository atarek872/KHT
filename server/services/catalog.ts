import type { Catalog } from '../../shared/types'
import { catalog as fallbackCatalog } from '../data/catalog.ts'
import type { D1Database } from '../utils/d1'

interface CategoryRow {
  slug: string
  nameEn: string
  nameAr: string
  image: string
}

interface ProductImageRow {
  productId: string
  url: string
}

export async function getCatalog(
  database?: D1Database,
  allowLocalFallback = false,
): Promise<Catalog> {
  if (!database) {
    if (allowLocalFallback) return fallbackCatalog
    throw new Error('The product catalog is temporarily unavailable.')
  }
  const [categoriesResult, productsResult, variantsResult, imagesResult] = await Promise.all([
    database
      .prepare(
        `SELECT slug, name_en AS nameEn, name_ar AS nameAr, image
        FROM categories WHERE active = 1 ORDER BY sort_order, name_en`,
      )
      .all<CategoryRow>(),
    database
      .prepare(
        `SELECT p.id, p.slug, p.code, p.category, p.price,
        p.compare_at_price AS compareAtPrice, p.image,
        p.name_en AS nameEn, p.name_ar AS nameAr, p.description_en AS descriptionEn,
        p.description_ar AS descriptionAr, p.detail_en AS detailEn, p.detail_ar AS detailAr,
        p.fit_en AS fitEn, p.fit_ar AS fitAr FROM products p
        JOIN categories c ON c.slug = p.category
        WHERE p.active = 1 AND c.active = 1 ORDER BY p.rowid`,
      )
      .all<Record<string, string | number>>(),
    database
      .prepare(
        `SELECT product_id AS productId, size, stock FROM inventory_variants
        WHERE active = 1 ORDER BY rowid`,
      )
      .all<{ productId: string; size: string; stock: number }>(),
    database
      .prepare(
        `SELECT pi.product_id AS productId, pi.url FROM product_images pi
        JOIN products p ON p.id = pi.product_id
        JOIN categories c ON c.slug = p.category
        WHERE p.active = 1 AND c.active = 1 ORDER BY pi.product_id, pi.sort_order`,
      )
      .all<ProductImageRow>(),
  ])
  return {
    ...fallbackCatalog,
    demo: false,
    categories: (categoriesResult.results || []).map((category) => ({
      slug: category.slug,
      name: { en: category.nameEn, ar: category.nameAr },
      image: category.image,
    })),
    products: (productsResult.results || []).map((product) => {
      const images = (imagesResult.results || [])
        .filter((image) => image.productId === product.id)
        .map((image) => image.url)
      if (!images.length) images.push(String(product.image))
      return {
      id: String(product.id),
      slug: String(product.slug),
      code: String(product.code),
      category: String(product.category),
      price: Number(product.price),
      compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
      image: images[0]!,
      images,
      name: { en: String(product.nameEn), ar: String(product.nameAr) },
      description: { en: String(product.descriptionEn), ar: String(product.descriptionAr) },
      detail: { en: String(product.detailEn), ar: String(product.detailAr) },
      fit: { en: String(product.fitEn), ar: String(product.fitAr) },
      sizes: (variantsResult.results || [])
        .filter((variant) => variant.productId === product.id)
        .map((variant) => ({ name: variant.size, stock: variant.stock })),
      }
    }),
  }
}
