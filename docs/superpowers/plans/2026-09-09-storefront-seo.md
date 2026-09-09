# KHT Storefront SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the KHT production storefront crawlable and provide accurate canonical, social, sitemap, and ecommerce structured data.

**Architecture:** Reuse Nuxt head composables and the existing D1 catalog service. A small SEO composable owns canonical and JSON-LD output, while Worker routes generate production-aware robots and sitemap responses.

**Tech Stack:** Nuxt 4, Vue 3, Nitro, Cloudflare Workers, D1, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-09-storefront-seo-design.md`

## Global Constraints

- Canonical origin is exactly `https://kht.tknology.online`.
- Production public catalog pages are indexable; staging and private or transactional routes remain noindex.
- Structured data contains only visible, persisted facts.
- No new runtime dependency is introduced.
- Existing storefront and commerce behavior must remain unchanged.

---

### Task 1: SEO primitives and production indexing

**Files:**
- Create: `app/composables/useStoreSeo.ts`
- Modify: `app/layouts/default.vue`
- Modify: `nuxt.config.ts`
- Modify: `wrangler.jsonc`
- Test: `tests/storefront-seo.test.ts`

- [ ] Write failing tests for canonical URLs, JSON-LD safety, runtime robots policy, production indexing, Worker-first SEO routes, and custom-domain-only production.
- [ ] Run the focused tests and confirm the intended failures.
- [ ] Implement the shared SEO composable and environment-aware layout defaults.
- [ ] Update the Cloudflare production configuration while preserving staging isolation.
- [ ] Run the focused tests and type checking.

### Task 2: Dynamic discovery routes

**Files:**
- Create: `server/routes/robots.txt.ts`
- Create: `server/routes/sitemap.xml.ts`
- Test: `tests/storefront-seo.test.ts`

- [ ] Write failing tests for production and staging robots output and an XML sitemap containing static, category, and product URLs.
- [ ] Run the focused tests and confirm the intended failures.
- [ ] Implement the routes using the existing D1 catalog service.
- [ ] Run the focused tests.

### Task 3: Page metadata and structured data

**Files:**
- Modify: `app/pages/index.vue`
- Modify: `app/components/CollectionView.vue`
- Modify: `app/pages/products/[slug].vue`
- Modify: `app/pages/about.vue`
- Modify: `app/pages/[info].vue`
- Modify: private and transactional storefront pages as needed
- Test: `tests/storefront-seo.test.ts`

- [ ] Write failing tests for homepage store data, product offers and breadcrumbs, collection metadata, absolute images, canonical URLs, and noindex routes.
- [ ] Run the focused tests and confirm the intended failures.
- [ ] Add server-rendered page metadata and JSON-LD.
- [ ] Run focused tests and type checking.

### Task 4: Full verification and production release

**Files:**
- Modify: documentation only if verification reveals an implementation constraint.

- [ ] Run all tests.
- [ ] Run Nuxt type checking.
- [ ] Build and verify the Cloudflare artifact.
- [ ] Inspect the staged output for canonical metadata and JSON-LD.
- [ ] Commit only the SEO work and push `main`.
- [ ] Deploy the production Worker.
- [ ] Smoke-test public and private indexing directives, robots, sitemap, structured data, social images, and canonical URLs on `https://kht.tknology.online/`.
