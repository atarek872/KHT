# KHT Storefront SEO Design

## Goal

Make `https://kht.tknology.online/` the single crawlable production origin and give search engines and social platforms accurate, server-rendered information about the KHT store, collections, and products.

## Scope

- Enable indexing only in the production Cloudflare environment.
- Keep staging, account, cart, checkout, order, tracking, search, and Admin pages out of search results.
- Publish a live XML sitemap derived from the current D1 catalog.
- Publish a production-aware robots response that advertises the sitemap.
- Add self-referencing canonical URLs and complete Open Graph and Twitter metadata to indexable pages.
- Add server-rendered JSON-LD for the online store, products, offers, and breadcrumbs.
- Use only facts already present in the catalog and storefront policies. Do not invent ratings, reviews, availability, prices, social profiles, or shipping promises.
- Keep guest checkout, customer accounts, products, inventory, and Admin behavior unchanged.

## Architecture

Centralize canonical URL construction, absolute media URLs, social metadata, and JSON-LD serialization in a storefront SEO composable. Pages provide their own title, description, image, canonical path, robots policy, and structured-data objects while retaining the existing Nuxt `useSeoMeta` and `useHead` approach.

Add server routes for `/sitemap.xml` and `/robots.txt`. The sitemap reads active products and categories through the existing catalog service and emits only canonical public URLs. The robots route uses the Cloudflare environment flag: production allows crawling and points to the sitemap; staging disallows crawling. Configure those two paths to run through the Worker before static assets.

The default layout supplies the environment-aware robots fallback and site-wide social defaults. Public pages override metadata as needed. Private and transactional pages retain explicit `noindex, nofollow` directives.

## Structured data

The homepage emits an `OnlineStore` node and a `WebSite` node. The store node contains the canonical identity, brand description, hero image, logo, customer-care contact details, and the verified 14-day Egyptian return policy already displayed by the storefront.

Product pages emit `Product`, `Offer`, and `BreadcrumbList` data. Product data includes the localized visible name and description, SKU, brand, absolute gallery images, color, price in EGP, canonical URL, new-item condition, and availability calculated from live variants. Ratings and reviews are omitted until the product data model contains real customer reviews.

Collection, category, drop, informational, and about pages emit breadcrumbs and page metadata where applicable. Search and query-driven filter variants remain non-indexable and canonicalize to their stable collection page.

## Domain and duplicate control

`kht.tknology.online` is the canonical host. The production `workers.dev` route is disabled after the custom domain is verified, removing the duplicate public origin. `/returns` canonicalizes to `/shipping` because both routes render the same policy content.

## Validation

- Unit tests cover URL normalization, JSON-LD escaping, metadata contracts, sitemap contents, robots behavior, private-route indexing, and Cloudflare configuration.
- Existing storefront and commerce tests must remain green.
- Type checking, Cloudflare build verification, and production smoke tests must pass.
- Production HTML must expose `index, follow`, canonical tags, social images, and JSON-LD; private routes must expose `noindex`.
- `/robots.txt`, `/sitemap.xml`, catalog URLs, and social images must return successful responses on the custom domain.

## Follow-up outside code

Google Search Console ownership and Google Merchant Center feeds require account access. After deployment, the owner can verify the domain, submit `/sitemap.xml`, and connect a Merchant Center feed. These integrations are not prerequisites for the technical SEO release.
