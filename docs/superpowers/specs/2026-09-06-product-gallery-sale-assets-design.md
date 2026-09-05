# KHT Product Gallery, Sale Pricing, and Campaign Assets Design

**Date:** 2026-09-06  
**Status:** Approved in chat, pending written-spec review  
**Target:** `kht-commerce-production.atarek872.workers.dev` (direct production candidate)

## Goal

Extend the existing KHT product workflow so an Admin can manage up to eight ordered product images
and an optional previous price, while preserving current products and server-authoritative COD
pricing. Replace only the approved Drop 001 and Our Story images, remove the currently displayed
Consumer Protection hotline number, and deploy the result directly to the production candidate.

The storefront home-page hero is explicitly out of scope and must remain unchanged.

## Approved visual changes

- `/drops/001`: replace the image next to `THE FIRST CHAPTER` with the supplied `Photo 1.jpg`.
- `/about`: replace the current garment image with the supplied black `KHT (Facebook Cover).png`.
- `/`: preserve the current hero image and hero layout without modification.
- Convert the supplied images to web-friendly WebP assets and generate the responsive widths used by
  `StoreImage`. Preserve the intended crop through explicit intrinsic dimensions and page-specific
  `object-fit`/`object-position` rules.

## Data model

Add migration `0008_product_gallery_sale_pricing.sql`.

1. Add nullable `compare_at_price` to `products`. When present, it must be a whole EGP amount greater
   than the current `price`; otherwise it is stored as `NULL`.
2. Add `product_images` with:
   - UUID `id` primary key;
   - required `product_id` foreign key with cascade deletion;
   - required store-relative `url`;
   - zero-based non-negative `sort_order`;
   - uniqueness for a product's URL and position.
3. Backfill every existing product's current `products.image` value as gallery position zero.
4. Retain `products.image` as the denormalized primary image for compatibility with existing order,
   cart, Admin-list, and storefront paths. Product saves keep it equal to the first gallery image.

The normalized `product_images` table is authoritative for gallery ordering. The retained primary
column avoids breaking historical order snapshots and limits this release's migration risk.

## Product contracts and validation

Add `images: string[]` and `compareAtPrice: number | null` to storefront and Admin product contracts.
The existing `image` property remains the first-image compatibility projection.

Server validation requires:

- one to eight unique store-relative image URLs;
- the first image to be the primary image;
- a non-negative whole current price;
- a missing/empty previous price, or a whole previous price strictly greater than the current price;
- all existing category, localized-content, SKU, variant, and stock rules.

Orders, cart totals, discounts, inventory variants, sorting, and checkout use only the current
`price`. The previous price is presentational and never participates in order calculations.

## Admin product experience

Replace the single-image control with an accessible ordered gallery manager:

- one multiple-file input accepting JPG, PNG, and WebP, with the existing 5 MB per-file limit;
- a hard maximum of eight images, with adjacent count and error guidance;
- preview cards labelled with their position and a visible `Primary` badge on the first image;
- Move previous, Move next, and Remove buttons that work with keyboard and touch;
- successful uploads remain visible if another selected file fails, with an actionable inline error;
- product submission is guarded while uploads are still running;
- at least one image is required before saving.

New uploads removed before save are deleted from R2. Existing images removed during an edit are
deleted only after the database save succeeds and only when no product/category reference remains.
The media deletion reference check includes `product_images`, the compatibility primary image, and
category images.

The Pricing section contains:

- required `Current price (EGP)`;
- optional `Previous price (EGP)`;
- help text explaining that the previous price must be higher and creates the storefront sale
  presentation;
- server error messages preserved in the existing form error region.

## Storefront experience

Product cards continue to use the primary image. When `compareAtPrice > price`, cards show the old
price with semantic `<del>`, the current price, and a calculated percentage badge.

The product-detail page:

- starts on the primary image;
- shows ordered thumbnail buttons when more than one image exists;
- updates the main and zoomed image when a thumbnail is chosen;
- gives every image a localized view-number alternative label;
- shows old price, current price, and percentage reduction in the main price area and mobile buy bar.

The reduction is `round((compareAtPrice - price) / compareAtPrice * 100)`. If no valid previous price
exists, the current single-price presentation remains unchanged. Bag, checkout, confirmations, and
Admin order records continue to show the charged current price only.

## Policy copy

Remove every visible occurrence and automated assertion for hotline `19588`. Keep the already
published 14-day eligible-return and 30-day defective-item rights and the rest of the policy copy.
The hotline can be restored in a later counsel-approved commercial-launch change.

## Production safety and deployment

The user requested direct production deployment without a separate staging acceptance pass. Before
changing production:

1. record the active Worker version;
2. record a D1 Time Travel bookmark and export the database to the ignored deployment-artifact
   directory;
3. inspect current production row counts without modifying catalog data;
4. run focused automated tests, the complete test suite, type checking, Cloudflare build verification,
   and a Wrangler dry run;
5. apply migration `0008` to the production D1 database;
6. deploy the exact verified commit to the existing production Worker;
7. smoke-check public catalog/gallery fields, security headers, unauthenticated Admin rejection,
   authenticated Admin reads, and the two updated page assets.

Do not create, edit, seed, or delete production products as part of deployment. If migration or
deployment verification fails, stop before further production changes and use the recorded Worker
version or D1 bookmark as appropriate.

## Verification criteria

- Existing product images backfill into position zero without loss.
- One to eight images save and return in stable order; zero, duplicate, or ninth images are rejected.
- Reordering changes the primary image and the compatibility `image` value atomically.
- Removing an existing image cannot delete a still-referenced R2 object.
- Previous price accepts `NULL` or a whole amount above current price and rejects all other values.
- Current server price remains authoritative for cart and COD order totals.
- Product cards and detail galleries expose accessible sale and image-selection semantics.
- `/drops/001` uses the supplied tracksuit image; `/about` uses the supplied KHT logo cover; the home
  hero source remains unchanged.
- No rendered policy copy contains `19588`.
- Production build, login protection, D1 binding, R2 binding, and security headers remain healthy.

## Deferred work

- Customer accounts, card payments, SMTP, automated abandoned-cart marketing, and final commercial
  legal/business details remain out of scope.
- Search indexing stays disabled for this production candidate.
- Custom-domain work remains separate from this feature release.
