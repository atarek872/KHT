# Storefront Content Management Design

## Goal

Turn Admin Settings into a safe, bilingual content control centre for KHT. Admins can edit global brand details, contact channels, announcements, navigation, page headings, hero media, calls to action, legal/help content, and page-specific search/social metadata without changing code.

## Editing model

- The existing storefront copy and images are the built-in published defaults, so deployment causes no visual change.
- Content edits save to a draft. Publishing is a separate explicit action.
- Each publish creates an immutable version. Restoring a version copies it to draft for review before republishing.
- Settings uses focused tabs: Availability, Brand, Navigation, Pages & SEO, and Publishing.
- The page editor selects one page at a time and keeps English and Arabic fields adjacent.
- Image uploads reuse the authenticated Cloudflare R2 media endpoint. Heroes support a primary image and an optional mobile crop.

## Storefront scope

- Header announcement, logo/wordmark, primary/mobile navigation, footer labels, footer statement, contact channels, and social links become data-driven.
- Home, Shop, Drop 001, category template, About, Size Guide, Track Order, Shipping & Returns, Contact, FAQ, Privacy, and Terms receive editable page content and SEO.
- Home keeps its established art direction while its hero content and main marketing sections become editable.
- Product, cart, checkout, authentication, account, and order pages keep their focused commerce layouts. Their system labels remain controlled by the application to protect task completion.
- Utility pages can display a configured hero, but default to the existing compact heading where that is better for conversion.

## Data and API

A singleton D1 state row stores complete draft and published JSON documents with audit timestamps and actors. A versions table stores every published snapshot.

- `GET /api/admin/store-content` returns draft, published metadata, and version history.
- `PUT /api/admin/store-content/draft` validates and saves a draft.
- `POST /api/admin/store-content/publish` validates, saves, publishes, and versions the submitted content atomically.
- `POST /api/admin/store-content/restore` restores an existing version to draft.
- `GET /api/storefront/content` returns only the published document and revision.

All admin routes use the existing admin session. Text is stored as plain text, links are restricted to safe relative paths or HTTPS URLs, media paths are restricted to KHT local/R2 images, and array counts and field lengths are bounded.

## Delivery and caching

A Nuxt plugin loads published content before rendering so headers, page copy, and SEO are correct during SSR and client navigation. Public requests fall back to the compiled defaults if content is temporarily unavailable. Publishing is visible on the next page load without a long CDN cache.
