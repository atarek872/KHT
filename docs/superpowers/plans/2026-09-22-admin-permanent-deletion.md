# Admin Permanent Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add guarded permanent deletion for eligible orders, abandoned carts, and exact inventory variants in the KHT Admin, then publish the verified result to `kht-eg.com`.

**Architecture:** Keep deletion rules in the existing service layer and expose three authenticated, same-origin `DELETE` routes. D1 batches guard every destructive statement against current relationships and state so a stale Admin page cannot partially delete linked data. Existing Admin list/detail pages reuse `AdminConfirmDialog`, with an exact order-number challenge for financial history and a shared small trash action for all three areas.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Nitro/H3 API routes, Cloudflare D1, Node test runner, Wrangler.

**Spec:** `docs/superpowers/specs/2026-09-22-admin-permanent-deletion-design.md`

## Global Constraints

- Hard-delete only; no trash table, bulk delete, scheduled cleanup, customer deletion, or product hard deletion.
- Never change inventory while deleting an order.
- Require a cancelled order to have `inventory_restored_at`, and a returned order to have `returned_restocked_at`; delivered orders are also eligible.
- Reject cart deletion while any order references `orders.cart_id`.
- Reject variant deletion while any historical `order_items.variant_id` references it.
- Remove a deleted variant from cart items, recalculate affected cart totals, clear empty carts, and archive a parent product with no active variants.
- Every new mutation requires Admin authentication and an explicit same-origin check.
- Keep desktop and mobile actions accessible with a visually compact button and a minimum 44-pixel touch target.
- No database migration is required.
- Preserve unrelated local changes in `.env.example` and `.codex-remote-attachments/`. `shared/adminOrder.ts` currently has no content diff despite its working-tree marker; when Task 2 adds planned types, stage only the resulting feature diff and confirm it contains no unrelated edits.
- Deploy directly to the existing `kht-commerce-production` Worker and verify `https://kht-eg.com`; do not deploy staging.

## Review Focus

- A stale page tries to delete an order after its status changed: the guarded delete affects zero rows, preserves references, and returns `409`.
- The typed order number differs by any character: the server rejects deletion with `409`, even if the browser control is bypassed.
- A cart gains an order relationship before deletion: the cart, items, events, and merge receipt all remain and the route returns `409`.
- A variant is referenced by historical order data: neither the variant nor matching cart items are removed, and the route returns `409`.
- Deleting the last active variant: open cart totals become authoritative, empty carts become `cleared`, and the parent product becomes inactive.

---

### Task 1: Shared destructive confirmation and icon controls

**Files:**
- Modify: `app/components/KhtIcon.vue`
- Modify: `app/components/admin/AdminConfirmDialog.vue`
- Modify: `app/assets/css/admin.css`
- Modify: `tests/admin-accessibility.test.ts`

**Interfaces:**
- Consumes: Existing `AdminModal`, `AdminButton`, form styles, and `KhtIcon` SVG pattern.
- Produces: `KhtIcon name="trash"`; optional `requiredConfirmation` and `confirmationPrompt` props on `AdminConfirmDialog`; `.admin-delete-action` and `.admin-confirm-dialog__input` styles used by Tasks 3–5.

- [ ] **Step 1: Add failing shared-control assertions**

Add a test to `tests/admin-accessibility.test.ts` that reads both components and the Admin stylesheet:

```ts
test('permanent deletion controls are accessible and support exact confirmation', () => {
  const icon = read('../app/components/KhtIcon.vue')
  const confirm = read('../app/components/admin/AdminConfirmDialog.vue')
  const css = read('../app/assets/css/admin.css')

  assert.match(icon, /'trash'/)
  assert.match(confirm, /requiredConfirmation\?: string/)
  assert.match(confirm, /confirmationPrompt\?: string/)
  assert.match(confirm, /typedConfirmation/)
  assert.match(confirm, /:disabled="busy \|\| !confirmationMatches"/)
  assert.match(css, /\.admin-delete-action[\s\S]*min-width:\s*44px/)
  assert.match(css, /\.admin-delete-action[\s\S]*min-height:\s*44px/)
})
```

- [ ] **Step 2: Run the focused test and verify the new assertions fail**

Run: `node --experimental-strip-types --test tests/admin-accessibility.test.ts`

Expected: FAIL because the trash icon, exact-confirmation props, and delete-action styles do not exist.

- [ ] **Step 3: Extend the shared icon and confirmation dialog**

Add `trash` to the `KhtIcon` name union and render this monochrome outline:

```vue
<g v-else-if="name === 'trash'">
  <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" />
  <path d="M10 11v6M14 11v6" />
</g>
```

Extend `AdminConfirmDialog` without changing current callers:

```ts
const props = withDefaults(defineProps<{
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  danger?: boolean
  requiredConfirmation?: string
  confirmationPrompt?: string
}>(), {
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  busy: false,
  danger: false,
  requiredConfirmation: '',
  confirmationPrompt: 'Type the confirmation value to continue.',
})

const emit = defineEmits<{ confirm: []; close: [] }>()
const typedConfirmation = ref('')
const confirmationMatches = computed(
  () => !props.requiredConfirmation || typedConfirmation.value === props.requiredConfirmation,
)
watch(() => props.open, (open) => { if (open) typedConfirmation.value = '' })
function confirm() {
  if (confirmationMatches.value && !props.busy) emit('confirm')
}
```

Render a labelled text input when `requiredConfirmation` is non-empty, disable the danger button with `:disabled="busy || !confirmationMatches"`, and call `confirm()` from the button. Add `.admin-delete-action` as a 44×44 quiet square control with a red hover/focus state, plus full-width readable input styling for `.admin-confirm-dialog__input`.

- [ ] **Step 4: Run the focused test and typecheck**

Run:

```powershell
node --experimental-strip-types --test tests/admin-accessibility.test.ts
npm run typecheck
```

Expected: both commands PASS and existing confirmation callers compile without new props.

- [ ] **Step 5: Commit the shared controls**

```powershell
git add app/components/KhtIcon.vue app/components/admin/AdminConfirmDialog.vue app/assets/css/admin.css tests/admin-accessibility.test.ts
git commit -m "feat: add guarded admin delete controls"
```

### Task 2: Guarded order deletion service and endpoint

**Files:**
- Modify: `shared/adminOrder.ts`
- Modify: `server/services/adminOrders.ts`
- Create: `server/api/admin/orders/[id].delete.ts`
- Create: `tests/admin-permanent-deletion.test.ts`
- Modify: `tests/commerce-security.test.ts`

**Interfaces:**
- Consumes: `D1Database`, current order restoration timestamps, existing order cascades, `requireAdmin(event)`, `requireSameOrigin(event)`, and `requireJsonBody`.
- Produces: `AdminOrderSummary.canDelete`, `AdminOrderSummary.deleteBlockReason`, `deleteAdminOrder(database, id, expectedNumber): Promise<{ deleted: true; id: string }>` and `DELETE /api/admin/orders/:id` with `{ orderNumber: string }`.

- [ ] **Step 1: Write failing order-deletion service tests**

Create `tests/admin-permanent-deletion.test.ts`. Import `readFileSync` and `readdirSync` from `node:fs`, `createTestD1`, `deleteAdminOrder`, `getAdminOrder`, `listAdminOrders`, `transitionOrder`, `restockReturnedOrder`, and `createStorefrontOrder`. Define the shared real-schema helpers before the tests:

```ts
const migrationDirectory = new URL('../server/db/migrations/', import.meta.url)
const migrations = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => new URL(name, migrationDirectory))

function setup() {
  const testDatabase = createTestD1()
  for (const migration of migrations) {
    testDatabase.sqlite.exec(readFileSync(migration, 'utf8'))
  }
  return testDatabase
}

function checkoutInput() {
  return {
    requestId: crypto.randomUUID(),
    cartId: crypto.randomUUID(),
    customer: {
      name: 'Permanent Delete Test',
      phone: '01010000009',
      address: '12 Test Street',
      governorate: 'Cairo',
      city: 'Nasr City',
    },
    items: [{ id: 'kht-001', size: 'M', quantity: 1 }],
    shippingGovernorate: 'Cairo',
    paymentMethod: 'cod' as const,
  }
}

function count(sqlite: ReturnType<typeof createTestD1>['sqlite'], table: string, column: string, value: string) {
  return Number((sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} = ?`)
    .get(value) as { count: number }).count)
}

function stock(sqlite: ReturnType<typeof createTestD1>['sqlite']) {
  return Number((sqlite.prepare("SELECT stock FROM inventory_variants WHERE id = 'kht-001-m'")
    .get() as { stock: number }).stock)
}
```

Add tests that prove:

```ts
test('cancelled restored orders delete dependants without changing stock', async () => {
  const { database, sqlite, close } = setup()
  try {
    await createStorefrontOrder(database, checkoutInput())
    const order = sqlite.prepare('SELECT id, number FROM orders').get() as { id: string; number: string }
    await transitionOrder(database, order.id, 'cancelled', 'admin@kht.local')
    const stockBeforeDelete = stock(sqlite)

    await deleteAdminOrder(database, order.id, order.number)

    assert.equal(stock(sqlite), stockBeforeDelete)
    assert.equal(count(sqlite, 'orders', 'id', order.id), 0)
    assert.equal(count(sqlite, 'order_items', 'order_id', order.id), 0)
    assert.equal(count(sqlite, 'order_events', 'order_id', order.id), 0)
    assert.equal(count(sqlite, 'order_status_history', 'order_id', order.id), 0)
  } finally { close() }
})
```

Also add cases for pending rejection, cancelled-without-restoration rejection, returned-without-restock rejection, returned-after-restock success, delivered success, missing order (`ORDER_NOT_FOUND`), incorrect order number (`ORDER_DELETE_CONFLICT`), and a stale status change. In the stale-number/status cases insert an `abandoned_carts.recovered_order_id` reference and assert it remains unchanged. Assert `listAdminOrders` and `getAdminOrder` expose `canDelete` and the expected guidance for active orders.

- [ ] **Step 2: Run the new test and verify missing exports/types fail**

Run: `node --experimental-strip-types --test tests/admin-permanent-deletion.test.ts`

Expected: FAIL because `deleteAdminOrder`, `canDelete`, and `deleteBlockReason` are not defined.

- [ ] **Step 3: Add server-owned eligibility and guarded deletion**

Extend `AdminOrderSummary`:

```ts
canDelete: boolean
deleteBlockReason: string
```

In `server/services/adminOrders.ts`, import `OrderFulfillmentStatus`, define the deletion row, and add one helper used by list, detail, and deletion:

```ts
type OrderDeletionRow = {
  number: string
  fulfillmentStatus: OrderFulfillmentStatus
  inventoryRestoredAt?: string | null
  returnedRestockedAt?: string | null
}

function orderDeletionState(row: {
  fulfillmentStatus: OrderFulfillmentStatus
  inventoryRestoredAt?: string | null
  returnedRestockedAt?: string | null
}) {
  if (row.fulfillmentStatus === 'delivered') return { canDelete: true, deleteBlockReason: '' }
  if (row.fulfillmentStatus === 'cancelled') return row.inventoryRestoredAt
    ? { canDelete: true, deleteBlockReason: '' }
    : { canDelete: false, deleteBlockReason: 'Cancel inventory restoration must finish before deletion.' }
  if (row.fulfillmentStatus === 'returned') return row.returnedRestockedAt
    ? { canDelete: true, deleteBlockReason: '' }
    : { canDelete: false, deleteBlockReason: 'Restock inspected returned items before deletion.' }
  if (['pending', 'confirmed', 'processing'].includes(row.fulfillmentStatus)) {
    return { canDelete: false, deleteBlockReason: 'Cancel this order before deleting it.' }
  }
  return { canDelete: false, deleteBlockReason: 'Finish the active delivery before deleting it.' }
}
```

Select `inventory_restored_at` and `returned_restocked_at` in list/detail queries, map the helper into every response, and keep timestamps private. Implement:

```ts
export async function deleteAdminOrder(
  database: D1Database,
  id: string,
  expectedNumber: string,
) {
  const cleanId = id.trim()
  const cleanNumber = expectedNumber.trim()
  if (!cleanId || !cleanNumber) throw new Error('ORDER_DELETE_INVALID')
  const current = await database.prepare(`SELECT number,
    fulfillment_status AS fulfillmentStatus,
    inventory_restored_at AS inventoryRestoredAt,
    returned_restocked_at AS returnedRestockedAt
    FROM orders WHERE id = ?`).bind(cleanId).first<OrderDeletionRow>()
  if (!current) throw new Error('ORDER_NOT_FOUND')
  if (current.number !== cleanNumber || !orderDeletionState(current).canDelete) {
    throw new Error('ORDER_DELETE_CONFLICT')
  }

  const eligible = `((fulfillment_status = 'cancelled' AND inventory_restored_at IS NOT NULL)
    OR fulfillment_status = 'delivered'
    OR (fulfillment_status = 'returned' AND returned_restocked_at IS NOT NULL))`
  const results = await database.batch([
    database.prepare(`UPDATE abandoned_carts SET recovered_order_id = NULL
      WHERE recovered_order_id = ? AND EXISTS (
        SELECT 1 FROM orders WHERE id = ? AND number = ? AND ${eligible}
      )`).bind(cleanId, cleanId, cleanNumber),
    database.prepare(`DELETE FROM orders
      WHERE id = ? AND number = ? AND ${eligible}`).bind(cleanId, cleanNumber),
  ])
  if ((results[1]?.meta?.changes || 0) !== 1) throw new Error('ORDER_DELETE_CONFLICT')
  return { deleted: true as const, id: cleanId }
}
```

The order cascade removes items, events, status history, and discount redemption. The statements contain identical eligibility and number guards so a stale request cannot clear the abandoned-cart reference before a rejected delete.

- [ ] **Step 4: Add the protected DELETE route and security assertions**

Create `server/api/admin/orders/[id].delete.ts`:

```ts
import { deleteAdminOrder } from '../../../services/adminOrders'
import { requireAdmin } from '../../../utils/adminAuth'
import { requireJsonBody, requireSameOrigin } from '../../../utils/requestGuards'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  requireSameOrigin(event)
  const id = getRouterParam(event, 'id') || ''
  const body = await requireJsonBody<{ orderNumber?: unknown }>(event, 1_024)
  if (!id.trim() || typeof body.orderNumber !== 'string' || !body.orderNumber.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Enter the exact order number.' })
  }
  try {
    return await deleteAdminOrder(database, id, body.orderNumber)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'ORDER_DELETE_CONFLICT'
    throw createError({
      statusCode: code === 'ORDER_NOT_FOUND' ? 404 : code === 'ORDER_DELETE_INVALID' ? 400 : 409,
      statusMessage: code === 'ORDER_NOT_FOUND'
        ? 'Order not found.'
        : code === 'ORDER_DELETE_INVALID'
          ? 'Enter the exact order number.'
          : 'This order cannot be deleted. Refresh and check its current fulfillment state.',
    })
  }
})
```

Extend `tests/commerce-security.test.ts` so the new route must contain both `requireAdmin(event)` and `requireSameOrigin(event)`, and must use `requireJsonBody` for the typed number.

- [ ] **Step 5: Run focused deletion and security tests**

Run:

```powershell
node --experimental-strip-types --test tests/admin-permanent-deletion.test.ts
node --experimental-strip-types --test tests/commerce-security.test.ts tests/admin-orders.test.ts
```

Expected: all focused tests PASS, including the stale-state assertions.

- [ ] **Step 6: Commit the order backend**

```powershell
git add shared/adminOrder.ts server/services/adminOrders.ts server/api/admin/orders/[id].delete.ts tests/admin-permanent-deletion.test.ts tests/commerce-security.test.ts
git commit -m "feat: add guarded order deletion"
```

### Task 3: Order list and detail delete experience

**Files:**
- Modify: `app/pages/admin/orders/index.vue`
- Modify: `app/pages/admin/orders/[id]/index.vue`
- Modify: `app/assets/css/admin.css`
- Modify: `tests/admin-orders.test.ts`

**Interfaces:**
- Consumes: `AdminOrderSummary.canDelete`, `deleteBlockReason`, exact-confirmation props from Task 1, and `DELETE /api/admin/orders/:id` from Task 2.
- Produces: eligible-only delete actions in desktop/mobile lists and order detail, list/detail success/error feedback, and exact order-number requests.

- [ ] **Step 1: Add failing UI assertions for both layouts**

Extend `tests/admin-orders.test.ts`:

```ts
test('eligible orders expose exact-confirmation deletion on list and detail', () => {
  const list = read('../app/pages/admin/orders/index.vue')
  const detail = read('../app/pages/admin/orders/[id]/index.vue')
  for (const page of [list, detail]) {
    assert.match(page, /method:\s*'DELETE'/)
    assert.match(page, /AdminConfirmDialog/)
    assert.match(page, /required-confirmation/)
    assert.match(page, /orderNumber/)
  }
  assert.match(list, /order\.canDelete/)
  assert.match(list, /admin-orders-desktop[\s\S]*admin-delete-action/)
  assert.match(list, /admin-orders-mobile[\s\S]*admin-delete-action/)
  assert.match(detail, /order\.deleteBlockReason/)
  assert.match(detail, /navigateTo\('\/admin\/orders/)
})
```

- [ ] **Step 2: Run the order UI test and verify it fails**

Run: `node --experimental-strip-types --test tests/admin-orders.test.ts`

Expected: FAIL because order delete state, controls, and requests are absent.

- [ ] **Step 3: Add list deletion state and controls**

In the order list, add `pendingDeleteOrder`, `deleteBusy`, `deleteError`, and `deleteSuccess`. The delete handler must call:

```ts
await $fetch(`/api/admin/orders/${encodeURIComponent(target.id)}`, {
  method: 'DELETE',
  body: { orderNumber: target.number },
})
await refresh()
deleteSuccess.value = `${target.number} was permanently deleted.`
```

Add an announced alert/status above the table/cards. Add an `Actions` column with the existing print link and a trash button only when `order.canDelete`. Add the same action to each mobile card without nesting the button inside a `NuxtLink`. Open:

```vue
<AdminConfirmDialog
  :open="!!pendingDeleteOrder"
  title="Delete this order permanently?"
  :description="`This removes ${pendingDeleteOrder?.number}, its history, and its discount redemption. This cannot be undone.`"
  confirm-label="Delete permanently"
  :required-confirmation="pendingDeleteOrder?.number || ''"
  :confirmation-prompt="`Type ${pendingDeleteOrder?.number || ''} to confirm.`"
  danger
  :busy="deleteBusy"
  @close="pendingDeleteOrder = null"
  @confirm="deleteSelectedOrder"
/>
```

- [ ] **Step 4: Add detail deletion, guidance, and redirect**

Add a danger trash action beside `Print 10×15 label` when `order.canDelete`. When deletion is unavailable, show `order.deleteBlockReason` beneath Order actions. Use the same exact-number dialog and request body. On success:

```ts
await navigateTo(`/admin/orders?deleted=${encodeURIComponent(target.number)}`)
```

Read the list route query once to show an announced deletion notice after redirect. Keep status-transition confirmation separate from permanent-deletion confirmation so cancel/restock behavior remains unchanged.

- [ ] **Step 5: Run order tests and typecheck**

Run:

```powershell
node --experimental-strip-types --test tests/admin-orders.test.ts tests/admin-permanent-deletion.test.ts
npm run typecheck
```

Expected: all commands PASS; desktop and mobile markup both contain eligible-only controls.

- [ ] **Step 6: Commit the order UI**

```powershell
git add app/pages/admin/orders/index.vue app/pages/admin/orders/[id]/index.vue app/assets/css/admin.css tests/admin-orders.test.ts
git commit -m "feat: add permanent order delete actions"
```

### Task 4: Abandoned-cart deletion service, endpoint, and UI

**Files:**
- Modify: `server/services/abandonedCarts.ts`
- Create: `server/api/admin/abandoned-carts/[id].delete.ts`
- Modify: `app/pages/admin/abandoned-carts/index.vue`
- Modify: `app/pages/admin/abandoned-carts/[id].vue`
- Modify: `app/assets/css/admin.css`
- Modify: `tests/admin-permanent-deletion.test.ts`
- Modify: `tests/abandoned-carts.test.ts`
- Modify: `tests/commerce-security.test.ts`

**Interfaces:**
- Consumes: current cart/item/event/merge-receipt tables, `orders.cart_id`, Task 1 confirmation/icon controls, Admin authentication and same-origin guard.
- Produces: `deleteAbandonedCart(database, id): Promise<{ deleted: true; id: string }>` and `DELETE /api/admin/abandoned-carts/:id`, plus list/detail delete controls.

- [ ] **Step 1: Write failing cart deletion tests**

Extend `tests/admin-permanent-deletion.test.ts` with one cart containing items, an event, and a `cart_merge_receipts` row. Assert `deleteAbandonedCart` removes all four records. Add missing-cart rejection and a linked-order case:

```ts
await assert.rejects(
  () => deleteAbandonedCart(database, linkedCartId),
  /CART_DELETE_CONFLICT/,
)
assert.equal(count(sqlite, 'abandoned_carts', 'id', linkedCartId), 1)
assert.equal(count(sqlite, 'abandoned_cart_items', 'cart_id', linkedCartId), 1)
assert.equal(count(sqlite, 'cart_merge_receipts', 'cart_id', linkedCartId), 1)
```

The linked case must use an actual order with `orders.cart_id` so the test covers the real relationship.

- [ ] **Step 2: Run the deletion test and verify the cart export is missing**

Run: `node --experimental-strip-types --test tests/admin-permanent-deletion.test.ts`

Expected: FAIL because `deleteAbandonedCart` is not exported.

- [ ] **Step 3: Implement the guarded cart service and DELETE route**

Add to `server/services/abandonedCarts.ts`:

```ts
export async function deleteAbandonedCart(database: D1Database, id: string) {
  const cleanId = id.trim()
  if (!cleanId) throw new Error('CART_DELETE_INVALID')
  const cart = await database.prepare('SELECT id FROM abandoned_carts WHERE id = ?')
    .bind(cleanId).first<{ id: string }>()
  if (!cart) throw new Error('CART_NOT_FOUND')
  const linkedOrder = await database.prepare('SELECT id FROM orders WHERE cart_id = ? LIMIT 1')
    .bind(cleanId).first<{ id: string }>()
  if (linkedOrder) throw new Error('CART_DELETE_CONFLICT')

  const results = await database.batch([
    database.prepare(`DELETE FROM cart_merge_receipts WHERE cart_id = ?
      AND NOT EXISTS (SELECT 1 FROM orders WHERE cart_id = ?)`)
      .bind(cleanId, cleanId),
    database.prepare(`DELETE FROM abandoned_carts WHERE id = ?
      AND NOT EXISTS (SELECT 1 FROM orders WHERE cart_id = ?)`)
      .bind(cleanId, cleanId),
  ])
  if ((results[1]?.meta?.changes || 0) !== 1) throw new Error('CART_DELETE_CONFLICT')
  return { deleted: true as const, id: cleanId }
}
```

The cart delete cascades items and events; merge receipts are deleted first. Create the route with `requireAdmin(event)`, `requireSameOrigin(event)`, non-empty ID validation, `404` for `CART_NOT_FOUND`, `400` for `CART_DELETE_INVALID`, and `409` with `This cart belongs to an order and cannot be deleted.` for conflicts. Add the route to security assertions.

- [ ] **Step 4: Add failing cart UI assertions**

Extend `tests/abandoned-carts.test.ts`:

```ts
test('abandoned carts expose permanent deletion on desktop, mobile, and detail', () => {
  const list = read('../app/pages/admin/abandoned-carts/index.vue')
  const detail = read('../app/pages/admin/abandoned-carts/[id].vue')
  for (const page of [list, detail]) {
    assert.match(page, /method:\s*'DELETE'/)
    assert.match(page, /AdminConfirmDialog/)
    assert.match(page, /Delete permanently/)
  }
  assert.match(list, /admin-abandoned-desktop[\s\S]*admin-delete-action/)
  assert.match(list, /admin-abandoned-mobile[\s\S]*admin-delete-action/)
  assert.doesNotMatch(list, /<NuxtLink v-for="cart"[\s\S]*admin-delete-action/)
})
```

Run: `node --experimental-strip-types --test tests/abandoned-carts.test.ts`

Expected: FAIL because the list and detail have no permanent delete controls.

- [ ] **Step 5: Implement list and detail cart deletion**

Add selection, busy, error, and success state to the list. Call the DELETE route, refresh, then remove the dialog selection. Change each mobile abandoned-cart wrapper from a `NuxtLink` to an `article`; keep a focused `NuxtLink` around the customer/details so the trash button is never nested in a link. Add the small trash action in the desktop Actions column and mobile card.

In the detail header, add `Delete permanently`, reuse `AdminConfirmDialog`, and after success call:

```ts
await navigateTo('/admin/abandoned-carts?deleted=1')
```

Display route errors with `role="alert"`, disable competing recovery actions while deleting, and keep the existing recovery flow unchanged.

- [ ] **Step 6: Run cart tests and typecheck**

Run:

```powershell
node --experimental-strip-types --test tests/admin-permanent-deletion.test.ts tests/abandoned-carts.test.ts tests/abandoned-cart-recovery.test.ts tests/commerce-security.test.ts
npm run typecheck
```

Expected: all commands PASS, including linked-order preservation and valid mobile markup.

- [ ] **Step 7: Commit abandoned-cart deletion**

```powershell
git add server/services/abandonedCarts.ts server/api/admin/abandoned-carts/[id].delete.ts app/pages/admin/abandoned-carts/index.vue app/pages/admin/abandoned-carts/[id].vue app/assets/css/admin.css tests/admin-permanent-deletion.test.ts tests/abandoned-carts.test.ts tests/commerce-security.test.ts
git commit -m "feat: add abandoned cart deletion"
```

### Task 5: Inventory variant deletion, cart repair, and UI

**Files:**
- Modify: `server/services/inventory.ts`
- Create: `server/api/admin/inventory/[id].delete.ts`
- Modify: `app/pages/admin/inventory/index.vue`
- Modify: `app/assets/css/admin.css`
- Modify: `tests/admin-permanent-deletion.test.ts`
- Modify: `tests/inventory.test.ts`
- Modify: `tests/commerce-security.test.ts`

**Interfaces:**
- Consumes: exact inventory variant rows, `order_items.variant_id`, abandoned-cart item snapshots, products table, Task 1 confirmation/icon controls, Admin authentication and same-origin guard.
- Produces: `deleteInventoryVariant(database, id): Promise<{ deleted: true; id: string; removedFromCarts: number; productArchived: boolean }>` and `DELETE /api/admin/inventory/:id`, plus per-row/card delete actions.

- [ ] **Step 1: Write failing variant deletion tests**

Extend `tests/admin-permanent-deletion.test.ts` with these database-backed helpers and cases:

```ts
function insertSingleVariantProductAndTwoCarts(
  sqlite: ReturnType<typeof createTestD1>['sqlite'],
) {
  const variantId = 'kht-003-s'
  sqlite.exec(`
    UPDATE products SET active = 1 WHERE id = 'kht-003';
    UPDATE inventory_variants SET active = CASE WHEN id = '${variantId}' THEN 1 ELSE 0 END
      WHERE product_id = 'kht-003';
    INSERT INTO abandoned_carts(id, subtotal, items_count, state)
      VALUES ('empty-after-delete', 1290, 1, 'active'),
             ('mixed-after-delete', 2180, 2, 'active');
    INSERT INTO abandoned_cart_items
      (id, cart_id, product_id, variant_id, product_name, variant, image, quantity, unit_price, total)
      VALUES
      ('delete-only', 'empty-after-delete', 'kht-003', '${variantId}', 'The Line Trouser', 'Black / S', '/images/kht-003.webp', 1, 1290, 1290),
      ('delete-mixed', 'mixed-after-delete', 'kht-003', '${variantId}', 'The Line Trouser', 'Black / S', '/images/kht-003.webp', 1, 1290, 1290),
      ('keep-mixed', 'mixed-after-delete', 'kht-001', 'kht-001-m', 'The Line Tee', 'Black / M', '/images/kht-001.webp', 1, 890, 890);
  `)
  return variantId
}

function cartTotals(sqlite: ReturnType<typeof createTestD1>['sqlite'], id: string) {
  return sqlite.prepare(`SELECT subtotal, items_count AS itemsCount, state
    FROM abandoned_carts WHERE id = ?`).get(id) as {
      subtotal: number
      itemsCount: number
      state: string
    }
}

function productActive(sqlite: ReturnType<typeof createTestD1>['sqlite'], id: string) {
  return Number((sqlite.prepare('SELECT active FROM products WHERE id = ?')
    .get(id) as { active: number }).active)
}
```

Then add:

```ts
test('unused variant deletion repairs carts and archives a product with no active variants', async () => {
  const { database, sqlite, close } = setup()
  try {
    const variantId = insertSingleVariantProductAndTwoCarts(sqlite)
    const result = await deleteInventoryVariant(database, variantId)

    assert.equal(result.removedFromCarts, 2)
    assert.equal(result.productArchived, true)
    assert.equal(count(sqlite, 'inventory_variants', 'id', variantId), 0)
    assert.equal(count(sqlite, 'abandoned_cart_items', 'variant_id', variantId), 0)
    const empty = cartTotals(sqlite, 'empty-after-delete')
    assert.deepEqual(empty, { subtotal: 0, itemsCount: 0, state: 'cleared' })
    const mixed = cartTotals(sqlite, 'mixed-after-delete')
    assert.deepEqual(mixed, { subtotal: 890, itemsCount: 1, state: 'active' })
    assert.equal(productActive(sqlite, 'single-variant-product'), 0)
  } finally { close() }
})
```

Add cases that keep the parent active when another active variant exists, return `VARIANT_NOT_FOUND` for a missing ID, and reject an order-referenced variant with `VARIANT_DELETE_CONFLICT`. The conflict case must assert the variant and cart item both remain, covering the no-partial-delete review focus.

- [ ] **Step 2: Run the deletion test and verify the inventory export is missing**

Run: `node --experimental-strip-types --test tests/admin-permanent-deletion.test.ts`

Expected: FAIL because `deleteInventoryVariant` is not exported.

- [ ] **Step 3: Implement guarded variant deletion and cart recalculation**

Add to `server/services/inventory.ts`:

```ts
export async function deleteInventoryVariant(database: D1Database, id: string) {
  const cleanId = id.trim()
  if (!cleanId) throw new Error('VARIANT_DELETE_INVALID')
  const variant = await database.prepare(`SELECT v.id, v.product_id AS productId
    FROM inventory_variants v WHERE v.id = ?`).bind(cleanId).first<{ id: string; productId: string }>()
  if (!variant) throw new Error('VARIANT_NOT_FOUND')
  const used = await database.prepare('SELECT id FROM order_items WHERE variant_id = ? LIMIT 1')
    .bind(cleanId).first<{ id: string }>()
  if (used) throw new Error('VARIANT_DELETE_CONFLICT')

  const safeVariant = `EXISTS (SELECT 1 FROM inventory_variants v WHERE v.id = ?
    AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.variant_id = v.id))`
  const now = new Date().toISOString()
  const results = await database.batch([
    database.prepare(`UPDATE inventory_variants SET active = 0, updated_at = ?
      WHERE id = ? AND NOT EXISTS (SELECT 1 FROM order_items WHERE variant_id = ?)`)
      .bind(now, cleanId, cleanId),
    database.prepare(`UPDATE abandoned_carts SET
      subtotal = COALESCE((SELECT SUM(total) FROM abandoned_cart_items i
        WHERE i.cart_id = abandoned_carts.id AND i.variant_id <> ?), 0),
      items_count = COALESCE((SELECT SUM(quantity) FROM abandoned_cart_items i
        WHERE i.cart_id = abandoned_carts.id AND i.variant_id <> ?), 0),
      state = CASE WHEN NOT EXISTS (SELECT 1 FROM abandoned_cart_items i
        WHERE i.cart_id = abandoned_carts.id AND i.variant_id <> ?)
        THEN 'cleared' ELSE state END,
      version = version + 1
      WHERE state IN ('active', 'cleared')
        AND id IN (SELECT cart_id FROM abandoned_cart_items WHERE variant_id = ?)
        AND ${safeVariant}`)
      .bind(cleanId, cleanId, cleanId, cleanId, cleanId),
    database.prepare(`DELETE FROM abandoned_cart_items WHERE variant_id = ? AND ${safeVariant}`)
      .bind(cleanId, cleanId),
    database.prepare(`DELETE FROM inventory_variants WHERE id = ?
      AND NOT EXISTS (SELECT 1 FROM order_items WHERE variant_id = ?)`)
      .bind(cleanId, cleanId),
    database.prepare(`UPDATE products SET active = 0, updated_at = ?
      WHERE id = ? AND active = 1
      AND NOT EXISTS (SELECT 1 FROM inventory_variants WHERE id = ?)
      AND NOT EXISTS (SELECT 1 FROM inventory_variants WHERE product_id = ? AND active = 1)`)
      .bind(now, variant.productId, cleanId, variant.productId),
  ])
  if ((results[3]?.meta?.changes || 0) !== 1) throw new Error('VARIANT_DELETE_CONFLICT')
  return {
    deleted: true as const,
    id: cleanId,
    removedFromCarts: Number(results[1]?.meta?.changes || 0),
    productArchived: (results[4]?.meta?.changes || 0) === 1,
  }
}
```

The inventory deactivation and every destructive statement are guarded by the absence of historical order lines. The D1 batch serializes the cart cleanup, authoritative totals, variant deletion, and parent archive.

- [ ] **Step 4: Create the protected inventory DELETE route**

Create `server/api/admin/inventory/[id].delete.ts` with `requireAdmin(event)`, `requireSameOrigin(event)`, non-empty ID validation, and these mappings:

```ts
const statusCode = code === 'VARIANT_NOT_FOUND' ? 404
  : code === 'VARIANT_DELETE_INVALID' ? 400
    : 409
const statusMessage = code === 'VARIANT_DELETE_CONFLICT'
  ? 'This variant appears in order history and cannot be deleted.'
  : code === 'VARIANT_NOT_FOUND'
    ? 'Inventory variant not found.'
    : 'Choose a valid inventory variant.'
```

Add the route to the Admin/same-origin security assertions.

- [ ] **Step 5: Add failing inventory UI assertions**

Extend `tests/inventory.test.ts`:

```ts
test('inventory exposes exact-variant permanent deletion on desktop and mobile', () => {
  const page = read('../app/pages/admin/inventory/index.vue')
  assert.match(page, /method:\s*'DELETE'/)
  assert.match(page, /AdminConfirmDialog/)
  assert.match(page, /admin-inventory-desktop[\s\S]*admin-delete-action/)
  assert.match(page, /admin-inventory-mobile[\s\S]*admin-delete-action/)
  assert.match(page, /item\.productName[\s\S]*item\.color[\s\S]*item\.size[\s\S]*item\.sku/)
  assert.match(page, /removed from open carts/)
})
```

Run: `node --experimental-strip-types --test tests/inventory.test.ts`

Expected: FAIL because inventory has save controls only.

- [ ] **Step 6: Add exact-variant deletion to inventory list/cards**

Add `pendingDelete`, `deleting`, and the existing announced `message` state. The confirmation copy must identify product, color, size, and SKU and say the variant will be removed from open carts. Call:

```ts
const result = await $fetch<{
  deleted: true
  id: string
  removedFromCarts: number
  productArchived: boolean
}>(`/api/admin/inventory/${encodeURIComponent(item.id)}`, { method: 'DELETE' })
await refresh()
delete drafts[item.id]
messageError.value = false
message.value = `${item.productName} · ${item.color} / ${item.size} deleted.${
  result.productArchived ? ' The product was archived because no active variants remain.' : ''
}`
```

Add a trash action next to Save in the desktop row and mobile update area. Disable Save and delete for the same row while either mutation is active. Keep search/filter state intact after refresh.

- [ ] **Step 7: Run inventory tests and typecheck**

Run:

```powershell
node --experimental-strip-types --test tests/admin-permanent-deletion.test.ts tests/inventory.test.ts tests/persistent-cart.test.ts tests/commerce-security.test.ts
npm run typecheck
```

Expected: all commands PASS; historical references prevent every side effect and last-variant deletion archives the product.

- [ ] **Step 8: Commit inventory deletion**

```powershell
git add server/services/inventory.ts server/api/admin/inventory/[id].delete.ts app/pages/admin/inventory/index.vue app/assets/css/admin.css tests/admin-permanent-deletion.test.ts tests/inventory.test.ts tests/commerce-security.test.ts
git commit -m "feat: add inventory variant deletion"
```

### Task 6: Full regression, visual verification, and production deployment

**Files:**
- Modify only if verification finds a defect: files already listed in Tasks 1–5.
- Do not modify: production data, migrations, `.env.example`, or unrelated working-tree files.

**Interfaces:**
- Consumes: completed Tasks 1–5 on `main` and existing Cloudflare production bindings.
- Produces: verified commits pushed to `origin/main`, one deployed `kht-commerce-production` Worker version, and live-route evidence from `kht-eg.com`.

- [ ] **Step 1: Run focused tests together**

Run:

```powershell
node --experimental-strip-types --test tests/admin-permanent-deletion.test.ts tests/admin-orders.test.ts tests/abandoned-carts.test.ts tests/abandoned-cart-recovery.test.ts tests/inventory.test.ts tests/admin-accessibility.test.ts tests/admin-responsive.test.ts tests/commerce-security.test.ts tests/order-transitions.test.ts tests/persistent-cart.test.ts
```

Expected: every focused test PASS with no skipped deletion behavior.

- [ ] **Step 2: Run the complete project verification**

Run sequentially:

```powershell
npm test
npm run typecheck
npm run test:migration
npm run build:cloudflare
npm run verify:cloudflare-build
npx wrangler deploy --env production --dry-run
```

Expected: the full test suite, typecheck, migration verification, Cloudflare build, build verification, and deployment dry run all PASS.

- [ ] **Step 3: Review the Admin UI locally at desktop and mobile widths**

Open `/admin/orders`, one eligible order detail, `/admin/abandoned-carts`, one abandoned-cart detail, and `/admin/inventory`. Verify the trash action remains visually small but has a 44×44 target; confirmation focus and Escape behavior come from `AdminModal`; exact order-number confirmation remains disabled until it matches; alerts are announced; mobile cards contain no nested interactive controls; and existing Save, recovery, print, cancel, and restock actions still work.

- [ ] **Step 4: Confirm the deployable diff and push main**

Run:

```powershell
git diff --check
git status --short --branch
git log --oneline origin/main..main
git push origin main
```

Expected: only the planned feature files are committed; unrelated local files remain unstaged; `main` pushes successfully.

- [ ] **Step 5: Capture rollback information and deploy production**

Run:

```powershell
npx wrangler deployments list --env production
npx wrangler d1 time-travel info kht-commerce-production
npx wrangler deploy --env production
```

Expected: Wrangler deploys the exact verified `main` revision to `kht-commerce-production`. No D1 migration or data mutation is run.

- [ ] **Step 6: Verify public and protected production behavior**

Verify `https://kht-eg.com/` and the public storefront respond successfully. Verify unauthenticated requests to all three DELETE endpoints return an authentication failure and reveal no data. Sign in to Admin, verify the three pages render their new controls, then use disposable non-production-linked records only if an end-to-end delete is needed; never delete an existing customer order, live cart, or catalog variant as a smoke test.

Expected: storefront behavior is unchanged, Admin pages load, deletion routes are protected, and the deployed Worker version matches the release output.
