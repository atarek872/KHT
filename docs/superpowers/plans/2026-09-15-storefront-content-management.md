# Storefront Content Management Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement this plan task-by-task.

**Goal:** Add safe draft/publish content management for KHT global branding, navigation, page heroes, page copy, and SEO inside Admin Settings.

**Architecture:** Keep a validated complete content document in D1 with separate draft and published states. Load the published document through a Nuxt plugin, then consume one shared reactive state across header, footer, pages, and SEO. Preserve compiled defaults as a resilient fallback.

**Tech Stack:** Nuxt 4, Vue 3, Nitro, Cloudflare D1/R2/Workers, Node test runner.

---

### Task 1: Content contract, defaults, persistence, and versions

Create `shared/storeContent.ts`, migration `0014_storefront_content.sql`, and `server/services/storeContent.ts`. Test validation, draft isolation, publishing, immutable versions, restoring to draft, and public audit-field filtering.

### Task 2: Secure API and media references

Create the admin read/draft/publish/restore endpoints and public content endpoint. Extend media reference checks for draft, published, and version documents. Test authentication guards and projections.

### Task 3: Admin Settings content editor

Split Settings into Availability, Brand, Navigation, Pages & SEO, and Publishing views. Build one responsive content editor that reuses admin form primitives and R2 upload. Include reorder/add/remove navigation, per-page hero/section/SEO fields, bilingual preview, save feedback, draft state, publish history, and restore actions.

### Task 4: Storefront integration

Create a pre-render content loader and shared composable. Connect SiteHeader, SiteFooter, contact configuration, homepage hero/sections, collection pages, About, Size Guide, Track Order, and information pages. Keep product and transaction routes focused. Render page-specific SEO and social images from published content.

### Task 5: Verify and production release

Run the focused tests, full tests, typecheck, migration test, Cloudflare build, and build verification. Commit only feature files to main, push, apply migration 0014 to production, deploy `kht-commerce-production`, and confirm the public content endpoint, storefront, protected admin APIs, and Settings route on `kht-eg.com`.
