# Store Curtain Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement this plan task-by-task.

**Goal:** Add an admin-controlled monochrome storefront curtain with bilingual content, optional media, countdown, automatic opening, and temporary SEO behavior.

**Architecture:** Store one validated singleton record in D1. Serve a private admin representation and a minimal public representation. The default layout loads the public state during SSR, makes the store inert when active, and renders one accessible overlay component; the admin layout is untouched.

**Tech Stack:** Nuxt 4, Vue 3, Nitro API handlers, Cloudflare D1/R2/Workers, Node test runner.

---

### Task 1: Persistence and validation

**Files:**
- Create: `server/db/migrations/0013_store_curtain.sql`
- Create: `shared/storeCurtain.ts`
- Create: `server/services/storeCurtain.ts`
- Test: `tests/store-curtain.test.ts`

Write failing tests for defaults, validation, saving, public field filtering, and automatic expiry. Add the migration, shared types, mapping, validation, save, and public projection. Run the focused test.

### Task 2: Secure API and media integration

**Files:**
- Create: `server/api/admin/store-curtain.get.ts`
- Create: `server/api/admin/store-curtain.put.ts`
- Create: `server/api/storefront/store-curtain.get.ts`
- Modify: `server/services/mediaReferences.ts`
- Test: `tests/store-curtain.test.ts`

Assert that admin mutations use the existing admin guard, the public response excludes audit fields, and curtain media counts as referenced. Implement the endpoints and reference query, then run the focused and production readiness tests.

### Task 3: Admin Settings experience

**Files:**
- Create: `app/pages/admin/settings.vue`
- Modify: `app/components/admin/AdminSidebar.vue`
- Modify: `app/assets/css/admin.css`
- Modify: `tests/admin-shell.test.ts`
- Test: `tests/store-curtain.test.ts`

Add failing source-level UI assertions, then build the responsive form, existing R2 upload flow, image removal, state summary, activation warning, bilingual fields, timer controls, CTA controls, and live preview. Link Settings in the desktop and mobile shared navigation.

### Task 4: Storefront curtain and SEO

**Files:**
- Create: `app/components/StoreCurtain.vue`
- Modify: `app/layouts/default.vue`
- Modify: `app/assets/css/main.css`
- Test: `tests/store-curtain.test.ts`

Test the expected public fetch, inert content, suppression of the welcome gift, temporary robots/status behavior, strong blur, display typography, and countdown. Implement the overlay and expiry refresh behavior.

### Task 5: Verify, commit, and deploy

Run `npm test`, `npm run typecheck`, `npm run test:migration`, `npm run build:cloudflare`, and `npm run verify:cloudflare-build` serially. Commit only intended files on `main`, push `main`, apply the production D1 migration, deploy `kht-commerce-production`, and confirm the public endpoint defaults to inactive while the production storefront and admin Settings route respond correctly.
