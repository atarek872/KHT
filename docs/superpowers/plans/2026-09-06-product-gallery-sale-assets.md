# Product Gallery, Sale Pricing, and Campaign Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ordered multi-image products and optional compare-at pricing, publish the two approved static images, remove hotline 19588, and deploy the verified result directly to the existing production candidate.

**Architecture:** D1 migration `0008` adds a normalized ordered `product_images` table and nullable `compare_at_price`, while retaining `products.image` as the compatibility primary image. Admin saves gallery order atomically; storefront consumers receive both `images` and the primary `image`, and a shared pure helper derives sale percentage without affecting authoritative current-price order calculations.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Cloudflare Workers, D1/SQLite, R2, Sharp, Node test runner, Wrangler.

**Spec:** `docs/superpowers/specs/2026-09-06-product-gallery-sale-assets-design.md`

## Global Constraints

- Deploy directly to `kht-commerce-production.atarek872.workers.dev`; do not use staging.
- Preserve the home-page hero source and layout.
- `/drops/001` uses supplied `Photo 1.jpg`; `/about` uses supplied `KHT (Facebook Cover).png`.
- Allow one to eight unique product images; position zero is primary.
- `compareAtPrice` is `null` or a whole EGP value strictly greater than current `price`.
- Cart, checkout, inventory variants, discounts, orders, and sorting use current `price` only.
- Preserve existing production data; never seed or delete catalog records during deployment.
- Remove visible hotline `19588` while preserving the published return-rights copy.
- Use existing monochrome tokens, fonts, button patterns, focus styles, and 44px touch targets.
- Record Worker and D1 rollback points before the production migration.

---

### Task 1: D1 gallery and compare-at schema

**Files:**
- Create: `server/db/migrations/0008_product_gallery_sale_pricing.sql`
- Create: `tests/product-gallery-pricing.test.ts`
- Modify: `scripts/test-commerce-migration.mjs`
- Modify: `tests/clean-launch-data.test.ts`
- Modify: `server/db/operations/empty-commerce.sql`

**Interfaces:**
- Produces: `products.compare_at_price INTEGER | NULL`.
- Produces: `product_images(id, product_id, url, sort_order)` ordered by `sort_order`.
- Preserves: `products.image` and backfills it into gallery position zero.

- [ ] **Step 1: Write failing migration behavior tests**

Create a test that applies migrations `0001`–`0008`, then asserts literal outcomes:

```ts
const rows = sqlite.prepare(`
  SELECT product_id AS productId, url, sort_order AS sortOrder
  FROM product_images ORDER BY product_id, sort_order
`).all()
assert.deepEqual(rows, [
  { productId: 'kht-001', url: '/images/tee.png', sortOrder: 0 },
  { productId: 'kht-002', url: '/images/tracksuit.png', sortOrder: 0 },
  { productId: 'kht-003', url: '/images/pants.png', sortOrder: 0 },
])
assert.throws(() => sqlite.exec(`UPDATE products SET compare_at_price = price WHERE id = 'kht-001'`))
assert.throws(() => sqlite.exec(`INSERT INTO product_images VALUES ('duplicate', 'kht-001', '/images/tee.png', 1)`))
```

This catches a missing backfill, weak compare-price constraint, or missing gallery uniqueness.

- [ ] **Step 2: Run the new test and verify RED**

Run: `node --experimental-strip-types --test tests/product-gallery-pricing.test.ts`

Expected: FAIL because migration `0008_product_gallery_sale_pricing.sql` does not exist.

- [ ] **Step 3: Implement migration 0008**

```sql
ALTER TABLE products ADD COLUMN compare_at_price INTEGER
CHECK (compare_at_price IS NULL OR
  (typeof(compare_at_price) = 'integer' AND compare_at_price > price));

CREATE TABLE product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL CHECK (length(trim(url)) > 0),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  UNIQUE(product_id, url),
  UNIQUE(product_id, sort_order)
);
CREATE INDEX product_images_product_order_idx
ON product_images(product_id, sort_order);

INSERT INTO product_images (id, product_id, url, sort_order)
SELECT 'primary-' || id, id, image, 0 FROM products;
```

Add migration 0008 to the local migration runners. Delete `product_images` before `products` in the
clean operation and assert it is empty in the clean-operation test.

- [ ] **Step 4: Run migration tests and verify GREEN**

Run: `node --experimental-strip-types --test tests/product-gallery-pricing.test.ts tests/clean-launch-data.test.ts && npm run test:migration`

Expected: PASS with three backfilled starter images and existing inventory/order constraints intact.

- [ ] **Step 5: Commit schema slice**

```bash
git add server/db/migrations/0008_product_gallery_sale_pricing.sql server/db/operations/empty-commerce.sql scripts/test-commerce-migration.mjs tests/product-gallery-pricing.test.ts tests/clean-launch-data.test.ts
git commit -m "feat: add product gallery and sale price schema"
```

### Task 2: Product contracts, persistence, and media safety

**Files:**
- Modify: `shared/types.ts`
- Modify: `shared/adminProduct.ts`
- Create: `shared/productPricing.ts`
- Modify: `server/services/adminProducts.ts`
- Modify: `server/services/catalog.ts`
- Create: `server/services/mediaReferences.ts`
- Modify: `server/api/admin/media.delete.ts`
- Modify: `server/api/admin/products/[id].patch.ts`
- Modify: `server/data/catalog.ts`
- Modify: `tests/product-gallery-pricing.test.ts`
- Modify: `tests/admin-products.test.ts`
- Modify: `tests/order.test.ts`
- Modify: `tests/shipping.test.ts`

**Interfaces:**
- Produces: `Product.images: string[]`, `Product.compareAtPrice: number | null`.
- Produces: `AdminProductInput.images: string[]`, `AdminProductInput.compareAtPrice: number | null`.
- Produces: `getDiscountPercentage(price, compareAtPrice): number | null`.
- Produces: `isMediaReferenced(database, url): Promise<boolean>`.

- [ ] **Step 1: Extend real behavior tests and verify RED**

Add tests that call `validateProduct`, `saveProduct`, `getProduct`, `getCatalog`, and
`getDiscountPercentage` with a real SQLite-backed D1 adapter:

```ts
assert.equal(getDiscountPercentage(800, 1000), 20)
assert.equal(getDiscountPercentage(1000, null), null)
assert.equal(getDiscountPercentage(1000, 1000), null)

const saved = await saveProduct(database, {
  ...existing,
  price: 800,
  compareAtPrice: 1000,
  images: ['/images/back.webp', '/images/front.webp'],
})
assert.deepEqual(saved.images, ['/images/back.webp', '/images/front.webp'])
assert.equal(saved.image, '/images/back.webp')
assert.equal(saved.compareAtPrice, 1000)
```

Also assert rejection for zero images, nine images, duplicates, previous price equal/below current,
and non-integer prices. Confirm `priceOrder` still returns the current price literal.

Run: `node --experimental-strip-types --test tests/product-gallery-pricing.test.ts tests/admin-products.test.ts tests/order.test.ts tests/shipping.test.ts`

Expected: FAIL on missing fields/helper and old single-image persistence.

- [ ] **Step 2: Extend contracts and pricing helper**

```ts
export interface Product {
  // existing fields
  price: number
  compareAtPrice: number | null
  image: string
  images: string[]
}

export function getDiscountPercentage(price: number, compareAtPrice?: number | null) {
  if (typeof compareAtPrice !== 'number' || !Number.isFinite(price) ||
      !Number.isFinite(compareAtPrice) || compareAtPrice <= price) return null
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
}
```

Update static fallback products with `compareAtPrice: null` and `images: [image]`.

- [ ] **Step 3: Persist and read galleries atomically**

Query product image rows in `getProduct` and `getCatalog`, grouping them by product ID in stable
order. In `saveProduct`, validate the gallery and compare price, set `products.image = images[0]`,
delete the product's previous gallery rows, and insert the submitted gallery rows in the same D1
batch as the product and variant statements.

Use this normalization before validation:

```ts
const compareAtPrice = input.compareAtPrice === null || input.compareAtPrice === undefined
  ? null
  : input.compareAtPrice
const images = input.images.map((url) => url.trim())
```

- [ ] **Step 4: Make R2 deletion reference-aware**

Implement `isMediaReferenced` with one scalar query covering `products.image`, `product_images.url`,
and `categories.image`. The explicit media-delete endpoint returns 409 when true. Product edit
calculates removed old gallery URLs, saves first, then deletes only unreferenced `/api/media/<key>`
objects.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --experimental-strip-types --test tests/product-gallery-pricing.test.ts tests/admin-products.test.ts tests/order.test.ts tests/shipping.test.ts`

Expected: PASS, including order totals using only the current price.

- [ ] **Step 6: Commit service slice**

```bash
git add shared/types.ts shared/adminProduct.ts shared/productPricing.ts server/data/catalog.ts server/services/adminProducts.ts server/services/catalog.ts server/services/mediaReferences.ts server/api/admin/media.delete.ts server/api/admin/products/[id].patch.ts tests/product-gallery-pricing.test.ts tests/admin-products.test.ts tests/order.test.ts tests/shipping.test.ts
git commit -m "feat: persist product galleries and compare prices"
```

### Task 3: Accessible Admin gallery and price inputs

**Files:**
- Modify: `app/components/admin/products/ProductForm.vue`
- Modify: `app/assets/css/admin.css`
- Modify: `tests/admin-products.test.ts`
- Modify: `tests/admin-accessibility.test.ts`
- Modify: `tests/admin-responsive.test.ts`

**Interfaces:**
- Consumes: `AdminProductInput.images`, `AdminProductInput.compareAtPrice` from Task 2.
- Produces: ordered Admin payload with one to eight images and optional previous price.

- [ ] **Step 1: Add failing Admin behavior/contract tests**

Update Admin UI assertions to require a multiple native file input, `1 / 8` count guidance, Primary
text, named Move previous/Move next/Remove actions, current/previous visible labels, and a guarded
submit state during uploads. Keep the existing accessible error region and 44px action requirement.

Run: `node --experimental-strip-types --test tests/admin-products.test.ts tests/admin-accessibility.test.ts tests/admin-responsive.test.ts`

Expected: FAIL because the form supports only one `image` and one price field.

- [ ] **Step 2: Implement ordered upload state**

Initialize new products with `images: []` and `compareAtPrice: null`. Upload selected files until the
eight-image limit, preserving successes and one actionable failure message. Implement stable moves:

```ts
function moveImage(index: number, offset: -1 | 1) {
  const target = index + offset
  if (target < 0 || target >= form.images.length) return
  ;[form.images[index], form.images[target]] = [form.images[target]!, form.images[index]!]
}
```

Removing a newly uploaded URL calls the existing authenticated media-delete endpoint; existing URLs
are removed from the form and cleaned after successful save by Task 2.

- [ ] **Step 3: Render accessible gallery and pricing controls**

Use `<input type="file" multiple>` and an ordered list of preview cards. Every button gets a stable
English accessible name including image position. Use existing monochrome buttons and focus tokens.
Add `Current price (EGP)` and `Previous price (EGP) — optional`, with `min`, `step=1`, and adjacent
help. Prevent submit while `uploading` and announce upload errors with `role="alert"`.

- [ ] **Step 4: Add responsive Admin styles**

Use the existing CSS variables and flat borders. Gallery cards become a responsive grid; previews use
consistent aspect ratio; action buttons remain at least 44px; mobile collapses to one or two columns
without changing DOM/tab order.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `node --experimental-strip-types --test tests/admin-products.test.ts tests/admin-accessibility.test.ts tests/admin-responsive.test.ts && npm run typecheck`

Expected: PASS with no new colors, fonts, gradients, shadows, or inaccessible controls.

- [ ] **Step 6: Commit Admin UI slice**

```bash
git add app/components/admin/products/ProductForm.vue app/assets/css/admin.css tests/admin-products.test.ts tests/admin-accessibility.test.ts tests/admin-responsive.test.ts
git commit -m "feat: manage product galleries in Admin"
```

### Task 4: Storefront gallery and sale presentation

**Files:**
- Create: `app/components/ProductPrice.vue`
- Modify: `app/components/ProductCard.vue`
- Modify: `app/pages/products/[slug].vue`
- Modify: `app/assets/css/main.css`
- Modify: `tests/storefront-regression.test.ts`
- Modify: `tests/storefront.test.ts`

**Interfaces:**
- Consumes: `Product.image`, `Product.images`, `Product.price`, `Product.compareAtPrice`.
- Consumes: `getDiscountPercentage` from Task 2.
- Produces: semantic current/sale price UI and ordered product-detail image selection.

- [ ] **Step 1: Add failing storefront contract tests**

Require one reusable price component that renders `<del>` only for a valid previous price, current
price in all cases, and a textual percentage. Require product detail thumbnail buttons, selected-image
state, localized numbered alternative text, and zoom using the selected image.

Run: `node --experimental-strip-types --test tests/storefront-regression.test.ts tests/storefront.test.ts tests/product-gallery-pricing.test.ts`

Expected: FAIL because the current components render one image and one price.

- [ ] **Step 2: Implement reusable semantic price presentation**

`ProductPrice.vue` takes `price`, `compareAtPrice`, and optional `compact`. It uses the shared helper,
`<del>` for the old value, a current-price span, and a text badge such as `20% OFF` / `خصم 20٪`.
Replace price markup in product cards, product detail, and mobile buy bar. Do not alter bag or checkout
totals.

- [ ] **Step 3: Implement detail gallery selection**

Keep `selectedImageIndex = ref(0)`, reset it on route changes, derive `selectedImage`, and render
ordered thumbnail `<button>` controls only when more than one image exists. The main image and zoom
both use `selectedImage`; the primary remains eager and thumbnails are lazy. Preserve focus-visible
states and provide `aria-pressed` for the selected thumbnail.

- [ ] **Step 4: Add storefront styles using existing tokens**

Use only `--black`, `--ink`, `--muted`, `--line`, `--paper`, and existing font variables. Thumbnail
targets are at least 44px, overflow horizontally on small screens, and do not shift product details.
Old price uses a visible line-through; discount text is not color-only.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `node --experimental-strip-types --test tests/storefront-regression.test.ts tests/storefront.test.ts tests/product-gallery-pricing.test.ts && npm run typecheck`

Expected: PASS; current price remains the only price consumed by order code.

- [ ] **Step 6: Commit storefront slice**

```bash
git add app/components/ProductPrice.vue app/components/ProductCard.vue app/pages/products/[slug].vue app/assets/css/main.css tests/storefront-regression.test.ts tests/storefront.test.ts
git commit -m "feat: show product galleries and sale prices"
```

### Task 5: Approved static assets and hotline removal

**Files:**
- Create: `public/images/drop-001-banner.jpg`
- Create: `public/images/drop-001-banner.webp`
- Create: `public/images/our-story-cover.png`
- Create: `public/images/our-story-cover.webp`
- Create: responsive files under `public/images/optimized/`
- Modify: `scripts/optimize-images.mjs`
- Modify: `app/components/StoreImage.vue`
- Modify: `app/components/CollectionView.vue`
- Modify: `app/pages/about.vue`
- Modify: `app/pages/[info].vue`
- Modify: `tests/production-copy.test.ts`
- Modify: `tests/storefront-regression.test.ts`

**Interfaces:**
- Produces: `/images/drop-001-banner.webp` and `/images/our-story-cover.webp` plus responsive srcsets.
- Preserves: home page `/images/campaign.png` source.

- [ ] **Step 1: Add failing asset-placement tests**

Assert the supplied source files exist, the Drop banner references `/images/drop-001-banner.jpg`, the
About page references `/images/our-story-cover.png`, the home page still references
`/images/campaign.png`, and policy content contains no `19588`.

Run: `node --experimental-strip-types --test tests/production-copy.test.ts tests/storefront-regression.test.ts`

Expected: FAIL on old Drop/About sources and current hotline copy.

- [ ] **Step 2: Copy approved originals and extend optimizer**

Copy the exact supplied files to the named public paths. Extend `optimize-images.mjs` with source
descriptors so both PNG and JPG originals generate WebP originals and unique widths 240, 480, 800,
and intrinsic width without enlargement. Run: `npm run images:optimize`.

- [ ] **Step 3: Wire the approved page placements**

Update only `CollectionView`'s `drop-banner` source and `/about`'s `about-campaign` source, intrinsic
dimensions, and accurate bilingual alternative text. Extend `StoreImage`'s optimized-name matching.
Do not edit `app/pages/index.vue`.

- [ ] **Step 4: Remove hotline number**

Remove `19588` from English and Arabic complaints copy and adjust the test to require its absence
while retaining assertions for the 14-day and 30-day rights.

- [ ] **Step 5: Run asset and storefront verification**

Run: `node --experimental-strip-types --test tests/production-copy.test.ts tests/storefront-regression.test.ts && npm run typecheck`

Expected: PASS, and every generated responsive WebP stays below 500 KB where its source dimensions
permit.

- [ ] **Step 6: Commit content/assets slice**

```bash
git add public/images scripts/optimize-images.mjs app/components/StoreImage.vue app/components/CollectionView.vue app/pages/about.vue app/pages/[info].vue tests/production-copy.test.ts tests/storefront-regression.test.ts
git commit -m "feat: publish Drop and story campaign assets"
```

### Task 6: Full verification and direct production deployment

**Files:**
- Modify: `docs/KHT-local-admin-and-deployment.md`
- Modify: `docs/superpowers/plans/2026-09-06-product-gallery-sale-assets.md`
- Local ignored artifact: `.cloudflare-deploy/production-before-gallery-20260906.sql`

**Interfaces:**
- Consumes: verified source revision and migration 0008.
- Produces: deployed Worker version, D1 migration record, rollback bookmark, and smoke-test record.

- [ ] **Step 1: Run complete local verification**

Run each command freshly:

```bash
npm test
npm run test:migration
npm run test:production-readiness
npm run typecheck
npm run build:cloudflare
npm run verify:cloudflare-build
npx wrangler deploy --env production --dry-run
git diff --check
```

Expected: every command exits 0; all tests pass; dry run binds only production D1/R2.

- [ ] **Step 2: Commit the exact deployable revision**

Commit any final documentation/checklist updates without secrets. Verify `git status --short` is
empty and record `git rev-parse --short HEAD`.

- [ ] **Step 3: Capture rollback state before changing D1**

Run:

```bash
npx wrangler deployments list --env production
npx wrangler d1 time-travel info kht-commerce-production
npx wrangler d1 export kht-commerce-production --remote --output .cloudflare-deploy/production-before-gallery-20260906.sql
npx wrangler d1 execute kht-commerce-production --remote --command "SELECT (SELECT COUNT(*) FROM products) AS products, (SELECT COUNT(*) FROM product_images) AS product_images;"
```

For the pre-migration count, query `products` first and query `product_images` only after confirming
whether migration 0008 is already recorded; do not treat a missing pre-migration table as failure.

- [ ] **Step 4: Apply migration 0008 to production**

Run: `npx wrangler d1 migrations apply kht-commerce-production --remote`

Expected: exactly migration `0008_product_gallery_sale_pricing.sql` applies. Query counts and verify
each existing product has exactly one backfilled position-zero image before deploying code.

- [ ] **Step 5: Deploy exact verified code**

Run: `npx wrangler deploy --env production`

Record the new Worker version and URL. Do not modify products, categories, shipping, or orders.

- [ ] **Step 6: Smoke test production**

Verify:

- `/`, `/drops/001`, `/about`, `/returns`, `/admin/login` return 200;
- `/api/catalog` returns `images` and nullable `compareAtPrice` for any existing products;
- Drop/About HTML references the new assets and `/` still references the original campaign asset;
- `19588` is absent from rendered returns content;
- HSTS and CSP remain present;
- unauthenticated Admin API returns 401;
- production Admin login, product read, logout, and post-logout 401 all work;
- D1 product/image counts are unchanged except for one migration backfill row per existing product.

- [ ] **Step 7: Record deployment and commit metadata**

Update deployment docs with source revision, Worker version, prior version, D1 bookmark, export path,
migration result, and smoke results. Commit:

```bash
git add docs/KHT-local-admin-and-deployment.md docs/superpowers/plans/2026-09-06-product-gallery-sale-assets.md
git commit -m "chore: record gallery production deployment"
```
