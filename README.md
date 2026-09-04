# KHT — Black. White. Line.

Nuxt 4 storefront with an editorial monochrome identity, original concept fashion imagery, English and Arabic (RTL), collection filtering, search, product sizing, a persistent browser bag, and a complete **demo** checkout.

## Run locally

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Nuxt. English opens by default to match the campaign typography; the header language control switches the full interface to Arabic and remembers the preference.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

For the Sites Cloudflare target, use `npm run build:cloudflare`. This creates a Nuxt Cloudflare Worker and stages it in `dist/server` with assets in `dist/client`. `scripts/stage-sites.mjs` adapts the Nuxt output to the Sites archive layout. The development server remains a normal Nuxt application.

Admin order creation requires a Cloudflare D1 binding and configured admin credentials. See
[`docs/KHT-admin-setup.md`](docs/KHT-admin-setup.md).

## What's working

- Responsive campaign homepage, Drop 001, category collections and keyword search.
- URL-backed size filtering and price sorting.
- Product pages, available/unavailable sizes, concept measurement guide and image enlargement.
- Cart drawer and full cart, quantity changes, removals and cookie persistence.
- Guest checkout form, sample details, server-validated demo prices and quantities.
- Tab-local order previews, order lookup, empty states, errors and 404s.
- Native dialog focus containment, keyboard focus, screen-reader status messages and reduced-motion support.
- Checkout drafts retained in application memory when editing the bag, with phone validation and the final total beside confirmation. Drafts clear after completion or a full reload; contact data is never submitted.
- Bilingual category-aware search, responsive WebP images, and an actual-size image viewer with scrolling and fit mode.
- Brand story, sizing and transparent prelaunch information pages.

## Demo boundary

This is a functional storefront implementation, **not a live commerce integration**. Products, generated photographs, stock, measurements and prices are illustrative. The checkout explicitly requires acknowledgement of demo mode and creates no real order, reservation, payment, notification or delivery.

`server/data/catalog.ts` is the central sample catalog adapter. UI pages read `/api/catalog`. `/api/checkout` validates item IDs, sizes, aggregated quantities and prices against that catalog and returns a demo quote. It does not accept address/contact fields and does not save customer data. The UI retains its demo summary in the current tab's session storage. Language and the device's bag selections use cookies.

## Before accepting real orders

Choose the commerce platform and integrate its catalog, variants, inventory, carts and durable orders through server adapters. Configure real shipping coverage and charges, taxes where applicable, payment methods, verified payment webhooks and duplicate-submission protection. Replace all sample products and measurements with approved data and photography, supply the final logo, and publish approved store details, support channels and policies. Keep live checkout disabled until these integrations are complete.

No framework-specific commerce provider has been assumed. No payment keys are required for this demo.

## Project structure

- `app/` — Nuxt 4 UI, pages, reusable components, global identity tokens and styles.
- `server/` — catalog and demo checkout endpoints.
- `shared/` — shared types and order validation.
- `tests/` — price, quantity, size and duplicate-line validation tests.
- `public/images/` — four original concept images produced with the built-in image generator.
- `public/images/optimized/` — responsive WebP derivatives. Regenerate with `npm run images:optimize` after updating the originals.
- `docs/KHT-image-prompts.md` — image prompts and provenance.
- `docs/KHT-design-system.md` and `docs/KHT-information-architecture.md` — original design specifications.

Nuxt structure follows the [official Nuxt 4 documentation](https://nuxt.com/docs/4.x/directory-structure).
