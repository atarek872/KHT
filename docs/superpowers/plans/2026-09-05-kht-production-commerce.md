# KHT Production Commerce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the KHT concept storefront into a durable, production-ready COD store on Cloudflare with operable orders, customer CRM records, actionable abandoned carts, and safe staging deployment.

**Architecture:** Keep the existing Nuxt Cloudflare Worker and introduce one forward-only D1 migration plus focused commerce services. Storefront checkout, Admin mutations, customer history, inventory, and recovery activity share server-enforced state transitions and audit events; R2 remains the product-media store. Validate everything locally against a SQLite-backed D1 test adapter, then provision isolated Cloudflare staging resources before any public DNS change.

**Tech Stack:** Nuxt 4.5, Vue 3, TypeScript, Cloudflare Workers, D1/SQLite, R2, Wrangler 4, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-05-kht-production-commerce-design.md`

## Global Constraints

- Deployment target is Cloudflare Workers, D1, and R2; do not add Docker, PostgreSQL, MinIO, or VPS dependencies.
- Payment method is COD only; do not add card fields, payment keys, Paymob callbacks, or payment redirects.
- Checkout remains guest-first; do not add customer passwords, registration, or account pages.
- Prices, stock, discounts, and shipping totals are always recalculated on the server from D1 records.
- Production receives migrations only and never receives local demo seed data.
- Staging and production use separate D1 databases, R2 buckets, Admin secrets, and hostnames.
- Do not attach `tkteck.it.com` or make a deployment public without explicit user approval.
- Do not publish a public checkout until a real customer-service email and phone or WhatsApp number are configured.
- Preserve the existing KHT visual system and bilingual English/Arabic storefront copy.
- Every mutation requires validation, duplicate-submit protection, and an actionable error state.

---

### Task 1: SQLite-backed D1 integration tests and commerce migration

**Files:**

- Create: `tests/helpers/sqliteD1.ts`
- Create: `server/db/migrations/0007_production_commerce.sql`
- Create: `tests/production-commerce-migration.test.ts`
- Modify: `scripts/test-commerce-migration.mjs`
- Modify: `shared/adminOrder.ts`
- Modify: `shared/abandonedCart.ts`

**Interfaces:**

- Produces: `createTestD1(): { database: D1Database; sqlite: DatabaseSync; close(): void }`.
- Produces: `OrderFulfillmentStatus` with `returned` and `OrderEvent` audit records.
- Produces: `CartRecoveryState = 'active' | 'contacted' | 'dismissed' | 'converted' | 'recovered'`.
- Produces schema fields `orders.public_reference`, `orders.inventory_restored_at`, and `orders.returned_restocked_at`.
- Produces `customers.phone_normalized` and `request_rate_limits` for identity matching and abuse controls.

- [x] **Step 1: Write the failing migration and type tests**

```ts
test('production migration adds order audit and recovery state', () => {
  const sql = read('../server/db/migrations/0007_production_commerce.sql')
  assert.match(sql, /public_reference TEXT/)
  assert.match(sql, /CREATE TABLE order_events/)
  assert.match(sql, /CREATE TABLE abandoned_cart_events/)
  assert.match(sql, /phone_normalized TEXT/)
  assert.match(sql, /CREATE TABLE request_rate_limits/)
  assert.match(sql, /recovery_state TEXT/)
  assert.match(sql, /'returned'/)
})
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test tests/production-commerce-migration.test.ts`

Expected: FAIL because migration `0007_production_commerce.sql` and the D1 test helper do not exist.

- [x] **Step 3: Add the focused SQLite D1 adapter**

```ts
export function createTestD1() {
  const sqlite = new DatabaseSync(':memory:')
  const database: D1Database = {
    prepare(sql) {
      let values: unknown[] = []
      return {
        bind(...next) {
          values = next
          return this
        },
        async first<T>() {
          return (sqlite.prepare(sql).get(...values) as T | undefined) ?? null
        },
        async all<T>() {
          return { success: true, results: sqlite.prepare(sql).all(...values) as T[] }
        },
        async run() {
          const result = sqlite.prepare(sql).run(...values)
          return { success: true, meta: { changes: Number(result.changes) } }
        },
      }
    },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE')
      try {
        const results = []
        for (const statement of statements) results.push(await statement.run())
        sqlite.exec('COMMIT')
        return results
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
    },
  }
  return { database, sqlite, close: () => sqlite.close() }
}
```

- [x] **Step 4: Add migration `0007_production_commerce.sql`**

The migration must add and backfill a unique public reference, add one-time inventory markers,
create indexed `order_events` and `abandoned_cart_events` tables, add explicit recovery state and
contact timestamps, and replace the status validation trigger so `returned` is accepted.

```sql
ALTER TABLE orders ADD COLUMN public_reference TEXT;
ALTER TABLE orders ADD COLUMN inventory_restored_at TEXT;
ALTER TABLE orders ADD COLUMN returned_restocked_at TEXT;
ALTER TABLE customers ADD COLUMN phone_normalized TEXT;
UPDATE customers SET phone_normalized = phone WHERE phone_normalized IS NULL;
CREATE UNIQUE INDEX customers_phone_normalized_idx
  ON customers(phone_normalized) WHERE phone_normalized IS NOT NULL;
UPDATE orders
SET public_reference = number || '-' || upper(substr(hex(randomblob(4)), 1, 8))
WHERE public_reference IS NULL;
CREATE UNIQUE INDEX orders_public_reference_idx ON orders(public_reference);

CREATE TABLE order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  note TEXT,
  actor_email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX order_events_order_idx ON order_events(order_id, created_at DESC);

ALTER TABLE abandoned_carts ADD COLUMN recovery_state TEXT NOT NULL DEFAULT 'active'
  CHECK (recovery_state IN ('active','contacted','dismissed','converted','recovered'));
ALTER TABLE abandoned_carts ADD COLUMN contact_captured_at TEXT;
ALTER TABLE abandoned_carts ADD COLUMN recovered_order_id TEXT REFERENCES orders(id);

CREATE TABLE abandoned_cart_events (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES abandoned_carts(id) ON DELETE CASCADE,
  from_state TEXT,
  to_state TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX abandoned_cart_events_cart_idx
  ON abandoned_cart_events(cart_id, created_at DESC);

CREATE TABLE request_rate_limits (
  key_hash TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL CHECK (request_count >= 0),
  expires_at TEXT NOT NULL
);
CREATE INDEX request_rate_limits_expiry_idx ON request_rate_limits(expires_at);

DROP TRIGGER validate_order_statuses_before_update;
CREATE TRIGGER validate_order_statuses_before_update
BEFORE UPDATE OF payment_status, fulfillment_status ON orders
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NEW.payment_status NOT IN ('pending', 'paid', 'failed', 'refunded')
      THEN RAISE(ABORT, 'INVALID_PAYMENT_STATUS')
    WHEN NEW.fulfillment_status NOT IN
      ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned')
      THEN RAISE(ABORT, 'INVALID_FULFILLMENT_STATUS')
  END;
END;
```

- [x] **Step 5: Run migration checks**

Run: `npm run test:migration`

Expected: PASS with migrations `0001` through `0007` applied in order and the original inventory
triggers still active.

- [x] **Step 6: Run the focused Node tests**

Run: `node --experimental-strip-types --test tests/production-commerce-migration.test.ts`

Expected: PASS.

- [x] **Step 7: Commit the migration slice**

```bash
git add tests/helpers/sqliteD1.ts server/db/migrations/0007_production_commerce.sql tests/production-commerce-migration.test.ts scripts/test-commerce-migration.mjs shared/adminOrder.ts shared/abandonedCart.ts
git commit -m "feat: add production commerce schema"
```

### Task 2: Durable guest COD checkout and customer creation

**Files:**

- Create: `shared/storefrontOrder.ts`
- Create: `server/services/storefrontCheckout.ts`
- Create: `tests/storefront-checkout.test.ts`
- Modify: `server/api/checkout.post.ts`
- Modify: `server/services/createOrder.ts`
- Modify: `server/services/catalog.ts`
- Modify: `app/pages/checkout.vue`
- Modify: `app/composables/useStore.ts`
- Modify: `shared/createOrder.ts`

**Interfaces:**

- Consumes: `createTestD1()` and migration fields from Task 1.
- Produces: `StorefrontCheckoutInput` with `requestId`, `cartId`, customer fields, items, shipping governorate, optional coupon, and COD.
- Produces: `StorefrontOrderConfirmation` with public reference, statuses, server-priced lines, and totals.
- Produces: `createStorefrontOrder(database, input): Promise<StorefrontOrderConfirmation>`.

- [x] **Step 1: Write failing checkout integration tests**

```ts
test('guest checkout creates one customer and one order from server prices', async () => {
  const first = await createStorefrontOrder(database, input)
  const second = await createStorefrontOrder(database, input)
  assert.equal(second.reference, first.reference)
  assert.equal(count(sqlite, 'customers'), 1)
  assert.equal(count(sqlite, 'orders'), 1)
  assert.equal(sqlite.prepare('SELECT source FROM orders').get().source, 'website')
})

test('repeat phone updates the CRM record without losing order history', async () => {
  await createStorefrontOrder(database, input)
  await createStorefrontOrder(database, {
    ...input,
    requestId: crypto.randomUUID(),
    customer: { ...input.customer, address: 'New address' },
  })
  assert.equal(count(sqlite, 'customers'), 1)
  assert.equal(count(sqlite, 'orders'), 2)
})
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `node --experimental-strip-types --test tests/storefront-checkout.test.ts`

Expected: FAIL because `createStorefrontOrder` is not defined.

- [x] **Step 3: Extract a shared durable order writer**

Refactor `createOrder` so Admin and storefront checkout call the same internal function after their
different input validation. Keep server-side variant pricing, shipping lookup, coupon quote,
idempotency, customer upsert, order insert, line insert, inventory trigger, and discount usage in
one D1 batch. Store both the display phone and canonical `phone_normalized`, and use the canonical
value for repeat-customer lookup.

```ts
export async function createStorefrontOrder(
  database: D1Database,
  input: StorefrontCheckoutInput,
): Promise<StorefrontOrderConfirmation> {
  return createDurableOrder(database, {
    requestId: input.requestId,
    cartId: input.cartId,
    customer: normalizeCheckoutCustomer(input.customer),
    items: await resolveStorefrontVariants(database, input.items),
    shippingGovernorate: input.shippingGovernorate,
    paymentMethod: 'cod',
    source: 'website',
    couponCode: input.couponCode,
  })
}
```

- [x] **Step 4: Replace the demo checkout endpoint**

```ts
export default defineEventHandler(async (event) => {
  const database = requireDatabase(event)
  const input = await readBody<StorefrontCheckoutInput>(event)
  try {
    return await createStorefrontOrder(database, input)
  } catch (error) {
    throw checkoutError(error)
  }
})
```

Remove `demoAcknowledged`, the demo-only banner, sample-detail action, session-storage order, and all
copy claiming that no order is created. Keep the final button enabled when the native form is valid,
prevent duplicate submissions while busy, and retain the bag when the request fails.

- [x] **Step 5: Submit real customer and cart data from the checkout page**

```ts
const order = await $fetch<StorefrontOrderConfirmation>('/api/checkout', {
  method: 'POST',
  body: {
    requestId: requestId.value,
    cartId: cartId.value,
    customer: { ...form.value, governorate: form.value.city },
    items: lines.value.map(({ id, size, quantity }) => ({ id, size, quantity })),
    shippingGovernorate: form.value.city,
    couponCode: couponQuote.value?.couponCode,
    paymentMethod: 'cod',
  },
})
```

Reset the request ID and clear the bag only after the durable response succeeds.

Remove the production fallback to source-code demo products. `getCatalog` may use the fallback only
when no D1 binding exists in explicit local preview mode; a configured database error must fail
closed instead of displaying products that cannot be ordered.

- [x] **Step 6: Run checkout tests and regressions**

Run: `node --experimental-strip-types --test tests/storefront-checkout.test.ts tests/order.test.ts tests/commerce-safety.test.ts`

Expected: PASS with the old demo-only assertions replaced by durable-checkout assertions.

- [x] **Step 7: Commit durable checkout**

```bash
git add shared/storefrontOrder.ts shared/createOrder.ts server/services/storefrontCheckout.ts server/services/createOrder.ts server/services/catalog.ts server/api/checkout.post.ts app/pages/checkout.vue app/composables/useStore.ts tests/storefront-checkout.test.ts tests/order.test.ts tests/commerce-safety.test.ts
git commit -m "feat: create durable guest COD orders"
```

### Task 3: Persistent confirmation and secure order tracking

**Files:**

- Create: `server/services/storefrontOrders.ts`
- Create: `server/api/orders/[reference].get.ts`
- Create: `server/api/orders/track.post.ts`
- Create: `tests/storefront-order-tracking.test.ts`
- Modify: `app/pages/order-confirmation/[reference].vue`
- Modify: `app/pages/track-order.vue`
- Modify: `shared/storefrontOrder.ts`

**Interfaces:**

- Consumes: public reference and normalized phone from Task 2.
- Produces: `getOrderConfirmation(database, reference)` returning non-sensitive confirmation fields.
- Produces: `trackOrder(database, reference, phone)` returning confirmation plus current statuses only after both values match.

- [x] **Step 1: Write failing public-order privacy tests**

```ts
test('tracking requires both reference and matching phone', async () => {
  assert.equal(await trackOrder(database, reference, '01000000000'), null)
  const result = await trackOrder(database, reference, input.customer.phone)
  assert.equal(result?.reference, reference)
  assert.equal('customerId' in (result || {}), false)
})
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test tests/storefront-order-tracking.test.ts`

Expected: FAIL because the public order service does not exist.

- [x] **Step 3: Implement minimal public projections**

Use explicit SQL columns and never return internal order ID, customer ID, notes, admin events, or
another customer's contact data. Normalize the submitted phone before matching.

```ts
export async function trackOrder(database: D1Database, reference: string, phone: string) {
  const normalizedPhone = normalizeEgyptianPhone(phone)
  return loadPublicOrder(database, 'o.public_reference = ? AND c.phone_normalized = ?', [
    reference.trim().toUpperCase(),
    normalizedPhone,
  ])
}
```

- [x] **Step 4: Replace session-storage confirmation and tracking UI**

The confirmation route fetches its durable public projection. The tracking form collects order
reference and phone, posts them to `/api/orders/track`, and renders the returned status without
placing the phone in the URL.

- [x] **Step 5: Run focused tests**

Run: `node --experimental-strip-types --test tests/storefront-order-tracking.test.ts`

Expected: PASS for matching, non-matching, malformed, and unavailable references.

- [x] **Step 6: Commit public order access**

```bash
git add shared/storefrontOrder.ts server/services/storefrontOrders.ts server/api/orders app/pages/order-confirmation app/pages/track-order.vue tests/storefront-order-tracking.test.ts
git commit -m "feat: persist confirmations and order tracking"
```

### Task 4: Server-enforced Admin order workflow and inventory safety

**Files:**

- Create: `server/services/orderTransitions.ts`
- Create: `server/api/admin/orders/[id].patch.ts`
- Create: `server/api/admin/orders/[id]/restock.post.ts`
- Create: `tests/order-transitions.test.ts`
- Modify: `server/services/adminOrders.ts`
- Modify: `app/pages/admin/orders/[id].vue`
- Modify: `app/components/admin/orders/OrderStatus.vue`
- Modify: `shared/adminOrder.ts`
- Modify: `app/assets/css/admin.css`

**Interfaces:**

- Consumes: `OrderFulfillmentStatus`, order audit schema, and inventory markers from Task 1.
- Produces: `allowedFulfillmentTransitions(status): OrderFulfillmentStatus[]`.
- Produces: `transitionOrder(database, id, nextStatus, actorEmail, note?)`.
- Produces: `restockReturnedOrder(database, id, actorEmail, note?)`.

- [x] **Step 1: Write failing state-machine tests**

```ts
test('only valid fulfillment transitions are advertised', () => {
  assert.deepEqual(allowedFulfillmentTransitions('pending'), ['confirmed', 'cancelled'])
  assert.deepEqual(allowedFulfillmentTransitions('shipped'), ['delivered', 'returned'])
  assert.deepEqual(allowedFulfillmentTransitions('delivered'), [])
})

test('cancelling restores reserved stock exactly once', async () => {
  const before = stock(sqlite, variantId)
  await transitionOrder(database, orderId, 'cancelled', 'admin@kht.local')
  const after = stock(sqlite, variantId)
  await assert.rejects(() => transitionOrder(database, orderId, 'cancelled', 'admin@kht.local'))
  assert.equal(stock(sqlite, variantId), after)
  assert.equal(after, before + quantity)
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `node --experimental-strip-types --test tests/order-transitions.test.ts`

Expected: FAIL because the transition service is missing.

- [x] **Step 3: Implement the transition map and conflict checks**

```ts
const transitions: Record<OrderFulfillmentStatus, OrderFulfillmentStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: [],
  cancelled: [],
  returned: [],
}
```

Load the current row, reject a transition not present in the map, then batch the conditional order
update, inventory restoration when cancelling, and one audit event. Delivered COD updates payment
to `paid` in the same batch. Cancellation updates pending COD payment to `failed`.

- [x] **Step 4: Add authenticated mutation endpoints**

```ts
export default defineEventHandler(async (event) => {
  const { database, email } = await requireAdmin(event)
  const body = await readBody<{ fulfillmentStatus: OrderFulfillmentStatus; note?: string }>(event)
  return transitionOrder(
    database,
    getRouterParam(event, 'id') || '',
    body.fulfillmentStatus,
    email,
    body.note,
  )
})
```

Map stale or invalid transitions to HTTP `409`; use `404` for missing orders and `400` for malformed
input.

- [x] **Step 5: Add clear controls and audit timeline to Admin order detail**

Render only server-provided allowed next transitions. Require confirmation for cancellation and
returned-item restocking, keep actions disabled while saving, preserve the current order on error,
and refresh after success.

- [x] **Step 6: Run order workflow and Admin tests**

Run: `node --experimental-strip-types --test tests/order-transitions.test.ts tests/admin-orders.test.ts tests/customers.test.ts`

Expected: PASS, including status controls, terminal states, COD paid-on-delivery, one-time inventory
restoration, explicit returned restock, and audit events.

- [x] **Step 7: Commit order operations**

```bash
git add shared/adminOrder.ts server/services/orderTransitions.ts server/services/adminOrders.ts server/api/admin/orders app/pages/admin/orders app/components/admin/orders/OrderStatus.vue app/assets/css/admin.css tests/order-transitions.test.ts tests/admin-orders.test.ts tests/customers.test.ts
git commit -m "feat: operate COD order lifecycle"
```

### Task 5: Product dialog fix and reversible activation

**Files:**

- Create: `server/api/admin/products/[id]/activate.post.ts`
- Create: `tests/product-activation.test.ts`
- Modify: `app/assets/css/admin.css`
- Modify: `app/pages/admin/products/index.vue`
- Modify: `server/services/adminProducts.ts`
- Modify: `tests/admin-products.test.ts`

**Interfaces:**

- Produces: `activateProduct(database, id): Promise<AdminProduct>`.
- Preserves: existing `archiveProduct(database, id)` behavior and storefront active filters.

- [x] **Step 1: Write the failing dialog and activation tests**

```ts
test('closed product confirmation dialog stays hidden', () => {
  const css = read('../app/assets/css/admin.css')
  assert.match(css, /\.admin-modal:not\(\[open\]\)\s*\{\s*display:\s*none/)
})

test('inactive products expose a protected reactivate action', () => {
  assert.match(read('../app/pages/admin/products/index.vue'), /Reactivate/)
  assert.match(read('../server/api/admin/products/[id]/activate.post.ts'), /requireAdmin\(event\)/)
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `node --experimental-strip-types --test tests/product-activation.test.ts`

Expected: FAIL because closed-dialog CSS and activation endpoint are absent.

- [x] **Step 3: Fix the modal cascade at the source**

```css
.kht-admin .admin-modal:not([open]) {
  display: none;
}

.kht-admin .admin-modal[open] {
  display: flex;
  flex-direction: column;
}
```

Remove unconditional `display: flex` from the base dialog rule.

- [x] **Step 4: Implement safe reactivation**

Change future deactivation to update only `products.active`; the storefront already requires both an
active product and active variant, so variant choices must be preserved. Reactivation requires at
least one already-active variant, updates the product timestamp, leaves stock unchanged, and returns
the refreshed product. Products archived by the old implementation with every variant inactive must
be edited to select an active variant before Reactivate succeeds.

- [x] **Step 5: Update Admin product actions**

Show Deactivate only for active products and Reactivate only for inactive products. Open the
confirmation dialog only after the corresponding click and use action-specific copy and success
messages.

- [x] **Step 6: Run product tests**

Run: `node --experimental-strip-types --test tests/product-activation.test.ts tests/admin-products.test.ts tests/admin-accessibility.test.ts`

Expected: PASS.

- [x] **Step 7: Commit product activation**

```bash
git add server/api/admin/products/[id]/activate.post.ts server/services/adminProducts.ts app/pages/admin/products/index.vue app/assets/css/admin.css tests/product-activation.test.ts tests/admin-products.test.ts
git commit -m "fix: make product activation explicit and reversible"
```

### Task 6: Contactable abandoned carts and manual recovery workflow

**Files:**

- Create: `server/api/admin/abandoned-carts/[id].patch.ts`
- Create: `tests/abandoned-cart-recovery.test.ts`
- Modify: `shared/abandonedCart.ts`
- Modify: `server/services/abandonedCarts.ts`
- Modify: `server/api/cart/snapshot.put.ts`
- Modify: `app/composables/useStore.ts`
- Modify: `app/pages/checkout.vue`
- Modify: `app/pages/admin/abandoned-carts/[id].vue`
- Modify: `app/pages/admin/abandoned-carts/index.vue`
- Modify: `server/services/dashboard.ts`
- Modify: `tests/abandoned-carts.test.ts`

**Interfaces:**

- Consumes: cart ID from Task 2 and abandoned-cart schema from Task 1.
- Produces: `CartContactInput` with optional validated name, phone, and email.
- Produces: `updateRecoveryState(database, cartId, state, actorEmail, note?)`.
- Produces: Admin recovery events and `contacted`, `dismissed`, `converted`, and `recovered` states.

- [ ] **Step 1: Write failing contact and state tests**

```ts
test('checkout contact makes an abandoned cart actionable', async () => {
  await saveCartSnapshot(database, {
    cartId,
    items,
    contact: { name: 'Mona', phone: '01012345678' },
  })
  const cart = await getAbandonedCart(database, cartId)
  assert.equal(cart?.customerName, 'Mona')
  assert.equal(cart?.recoveryState, 'active')
})

test('manual recovery changes are audited', async () => {
  await updateRecoveryState(database, cartId, 'contacted', 'admin@kht.local', 'WhatsApp sent')
  assert.equal(eventCount(sqlite, cartId), 1)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --experimental-strip-types --test tests/abandoned-cart-recovery.test.ts`

Expected: FAIL because contact snapshots and recovery mutations are absent.

- [ ] **Step 3: Extend snapshots without collecting marketing consent**

Accept contact only when at least one valid phone or email exists, cap lengths, normalize phone and
email, and set `contact_captured_at`. Cart-only updates must not erase previously captured contact.

```ts
watchDebounced(
  () => [form.value.name, form.value.phone, form.value.email],
  () => snapshotCheckoutContact(),
  { debounce: 600 },
)
```

If the project has no `watchDebounced` utility, implement the same 600 ms behavior with a scoped
timer in `checkout.vue` and clear it in `onBeforeUnmount`; do not add a dependency for one helper.

- [ ] **Step 4: Mark checkout conversion in the durable order batch**

Update the matching cart to `state = 'converted'`, `recovery_state = 'converted'`, set
`recovered_order_id`, and write a cart event in the same successful checkout operation.

- [ ] **Step 5: Add authenticated recovery mutations and Admin actions**

Contactable carts get WhatsApp and `mailto:` links plus Mark contacted, Mark recovered, and Dismiss
actions. Anonymous carts display their products and value but do not render contact actions.

- [ ] **Step 6: Run cart and dashboard tests**

Run: `node --experimental-strip-types --test tests/abandoned-cart-recovery.test.ts tests/abandoned-carts.test.ts tests/dashboard.test.ts`

Expected: PASS with the existing 30-minute threshold preserved.

- [ ] **Step 7: Commit recovery workflow**

```bash
git add shared/abandonedCart.ts server/services/abandonedCarts.ts server/services/dashboard.ts server/api/cart/snapshot.put.ts server/api/admin/abandoned-carts app/composables/useStore.ts app/pages/checkout.vue app/pages/admin/abandoned-carts tests/abandoned-cart-recovery.test.ts tests/abandoned-carts.test.ts
git commit -m "feat: make abandoned carts actionable"
```

### Task 7: Production policies, contact configuration, and launch copy

**Files:**

- Create: `shared/storeConfig.ts`
- Create: `tests/production-copy.test.ts`
- Modify: `app/pages/[info].vue`
- Modify: `app/pages/cart.vue`
- Modify: `app/pages/checkout.vue`
- Modify: `app/pages/order-confirmation/[reference].vue`
- Modify: `app/pages/track-order.vue`
- Modify: `app/components/SiteFooter.vue`
- Modify: `nuxt.config.ts`
- Modify: `.env.example`

**Interfaces:**

- Produces: public runtime values `storeContactEmail`, `storePhone`, and `storeWhatsApp`.
- Produces original bilingual KHT policy copy for shipping, inspection, returns, exchanges, privacy,
  terms, and COD ordering.

- [ ] **Step 1: Write failing production-copy tests**

```ts
test('storefront no longer claims checkout is a concept preview', () => {
  const sources = storefrontFiles.map(read).join('\n')
  assert.doesNotMatch(sources, /concept preview|no commercial order|demo total|Preview order/i)
})

test('policies describe actual COD and cart data handling', () => {
  const page = read('../app/pages/[info].vue')
  assert.match(page, /cash on delivery|الدفع عند الاستلام/i)
  assert.match(page, /three calendar days|ثلاثة أيام/i)
  assert.match(page, /cart contents|محتويات السلة/i)
  assert.doesNotMatch(page, /Shopify|credit card/i)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --experimental-strip-types --test tests/production-copy.test.ts`

Expected: FAIL because concept-preview language remains.

- [ ] **Step 3: Add typed public business configuration**

```ts
export function useStoreContact() {
  const config = useRuntimeConfig().public
  return {
    email: String(config.storeContactEmail || ''),
    phone: String(config.storePhone || ''),
    whatsapp: String(config.storeWhatsApp || ''),
  }
}
```

Keep empty values hidden on staging. Add only variable names and safe examples to `.env.example`;
never commit live credentials or personal contact data.

- [ ] **Step 4: Replace demo copy with original bilingual operating copy**

Implement the approved KHT terms: inspection at delivery, refusal with shipping charge, exchange
within three calendar days, customer-paid exchange delivery, eligible unused/unaltered items with
tags and packaging, and exclusions for custom orders. The privacy page must describe KHT, D1/R2,
cart tracking, order records, and data-rights contact without mentioning Shopify, customer accounts,
card data, or automated marketing.

- [ ] **Step 5: Update metadata and launch guard**

Keep staging `noindex`. Make production robots configuration explicit through an environment flag,
but leave indexing disabled until the public launch approval.

- [ ] **Step 6: Run copy and storefront regressions**

Run: `node --experimental-strip-types --test tests/production-copy.test.ts tests/storefront-regression.test.ts tests/checkout-form.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit production copy**

```bash
git add shared/storeConfig.ts app/pages app/components/SiteFooter.vue nuxt.config.ts .env.example tests/production-copy.test.ts tests/storefront-regression.test.ts tests/checkout-form.test.ts
git commit -m "feat: publish KHT COD policies and contact configuration"
```

### Task 8: Mutation security, rate limits, and safe errors

**Files:**

- Create: `server/utils/requestGuards.ts`
- Create: `server/utils/rateLimit.ts`
- Create: `server/middleware/securityHeaders.ts`
- Create: `tests/commerce-security.test.ts`
- Modify: `server/api/admin/login.post.ts`
- Modify: `server/api/checkout.post.ts`
- Modify: `server/api/orders/track.post.ts`
- Modify: `server/api/cart/snapshot.put.ts`
- Modify: all new Admin mutation endpoints from Tasks 4–6

**Interfaces:**

- Produces: `requireJsonBody(event, maxBytes)` for content type and body-size guards.
- Produces: `enforceRateLimit(event, scope, limit, windowSeconds)` using a privacy-preserving hash.
- Produces: shared safe error mapping with a request identifier.

- [ ] **Step 1: Write failing security tests**

```ts
test('commerce mutations reject non-JSON and oversized bodies', () => {
  const guard = read('../server/utils/requestGuards.ts')
  assert.match(guard, /application\/json/)
  assert.match(guard, /content-length/i)
})

test('public sensitive endpoints use rate limits', () => {
  for (const path of sensitiveEndpoints) assert.match(read(path), /enforceRateLimit\(/, path)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --experimental-strip-types --test tests/commerce-security.test.ts`

Expected: FAIL because the guards do not exist.

- [ ] **Step 3: Implement request guards and safe headers**

Set `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
`Permissions-Policy`, and `frame-ancestors 'none'`. Ensure the CSP includes only resources already
used by KHT and does not break R2 images or Nuxt assets.

- [ ] **Step 4: Add bounded rate limits**

Use a D1-backed fixed window keyed by a SHA-256 hash of scope plus the connecting IP. Store only the
hash, count, and expiry. Apply stricter limits to Admin login and order tracking than cart snapshots;
return `429` with `Retry-After` when exceeded.

- [ ] **Step 5: Run security, auth, and cookie tests**

Run: `node --experimental-strip-types --test tests/commerce-security.test.ts tests/admin-login.test.ts tests/admin-cookie-security.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit security controls**

```bash
git add server/utils/requestGuards.ts server/utils/rateLimit.ts server/middleware/securityHeaders.ts server/api tests/commerce-security.test.ts tests/admin-login.test.ts tests/admin-cookie-security.test.ts
git commit -m "feat: harden commerce mutations"
```

### Task 9: Local end-to-end acceptance and documentation

**Files:**

- Create: `tests/production-readiness.test.ts`
- Modify: `server/db/seeds/local-demo.sql`
- Modify: `docs/KHT-local-admin-and-deployment.md`
- Modify: `README.md`
- Modify: `package.json`

**Interfaces:**

- Consumes: all services and routes from Tasks 1–8.
- Produces: repeatable `npm run test:production-readiness` command and an idempotent local scenario.

- [ ] **Step 1: Add a failing acceptance test**

The test must create a guest COD order, verify customer CRM data, transition it through delivery,
verify paid status and history, cancel a separate order and verify one-time stock restoration,
capture contactable and anonymous carts, exercise recovery states, deactivate/reactivate a product,
and confirm every mutation rejects an unauthenticated request.

```ts
test('complete COD operations remain durable and auditable', async () => {
  const order = await createStorefrontOrder(database, checkoutInput)
  const row = sqlite
    .prepare('SELECT id FROM orders WHERE public_reference = ?')
    .get(order.reference) as { id: string }
  await transitionOrder(database, row.id, 'confirmed', adminEmail)
  await transitionOrder(database, row.id, 'processing', adminEmail)
  await transitionOrder(database, row.id, 'shipped', adminEmail)
  await transitionOrder(database, row.id, 'delivered', adminEmail)
  assert.equal(loadOrder(sqlite, row.id).payment_status, 'paid')
  assert.equal(eventCount(sqlite, row.id), 5)
})
```

- [ ] **Step 2: Run the test to verify it fails before fixture updates**

Run: `node --experimental-strip-types --test tests/production-readiness.test.ts`

Expected: FAIL until the seed and acceptance helpers represent the new schema.

- [ ] **Step 3: Update local demo seed and commands**

Preserve idempotency. Add examples for the new order statuses and recovery states without changing
production migration behavior. Add `test:production-readiness` to `package.json`.

- [ ] **Step 4: Run the complete verification suite**

Run in order:

```bash
npm test
npm run test:migration
npm run test:production-readiness
npm run typecheck
npm run build:cloudflare
```

Expected: every command exits `0`; the Worker build exports a callable default `fetch` handler.

- [ ] **Step 5: Start the local Cloudflare runtime and smoke test**

Run: `npm run local:setup` then `npm run local:dev`.

Verify login, product activation, one storefront order, order tracking, Admin status transitions,
customer history, cart recovery actions, media upload, logout, and unauthenticated rejection. Keep
the final local server running for user review.

- [ ] **Step 6: Update operating documentation**

Document local setup, D1 migration order, no-demo production rule, Admin secret rotation, staging
acceptance, production launch gates, and rollback by Worker version. Do not document live secret
values.

- [ ] **Step 7: Commit readiness verification**

```bash
git add tests/production-readiness.test.ts server/db/seeds/local-demo.sql docs/KHT-local-admin-and-deployment.md README.md package.json package-lock.json
git commit -m "test: verify production COD commerce flow"
```

### Task 10: Provision and deploy private Cloudflare staging

**Files:**

- Create: `wrangler.jsonc`
- Create: `scripts/verify-cloudflare-build.mjs`
- Modify: `.gitignore`
- Modify: `.openai/hosting.json`
- Modify: `docs/KHT-local-admin-and-deployment.md`

**Interfaces:**

- Consumes: validated Cloudflare Worker build, D1 migrations, and R2 binding.
- Produces: private staging Worker, `kht-commerce-staging` D1 database, and
  `kht-product-media-staging` R2 bucket.
- Produces: no public DNS mutation.

- [ ] **Step 1: Verify Cloudflare authentication interactively**

Run: `npx wrangler whoami`.

If not authenticated, run `npx wrangler login` and let the user complete Cloudflare authorization
in the opened browser. Do not request or store the user's Cloudflare password.

- [ ] **Step 2: Create isolated staging resources**

Run:

```bash
npx wrangler d1 create kht-commerce-staging
npx wrangler r2 bucket create kht-product-media-staging
```

Record the exact D1 database ID returned by Wrangler in the staging environment section of
`wrangler.jsonc`. The committed file may contain Cloudflare resource identifiers, but never account
tokens, Admin passwords, or password hashes.

- [ ] **Step 3: Configure staging bindings and secrets**

Declare `DB`, `PRODUCT_MEDIA`, and `ASSETS` bindings, `nodejs_compat`, the staged Worker entrypoint,
and `noindex` public configuration. Generate a new staging Admin password locally and set
`ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` with `wrangler secret put`; do not reuse the local password
or print secret values into logs.

Create a Cloudflare Access application for the staging Worker hostname and allow only the email of
the currently signed-in Cloudflare owner. Verify an unauthenticated private-browser request is
redirected to Access before continuing.

- [ ] **Step 4: Apply migrations without demo seeds**

Run: `npx wrangler d1 migrations apply DB --env staging --remote`.

Expected: migrations `0001` through `0007` apply successfully. Do not run `npm run local:seed` or
execute `server/db/seeds/local-demo.sql` against the remote database.

- [ ] **Step 5: Build and deploy staging**

Run:

```bash
npm run build:cloudflare
node scripts/verify-cloudflare-build.mjs
npx wrangler deploy --env staging
```

The verification script imports `dist/server/index.js` and exits non-zero unless the default export
has a callable `fetch` method.

- [ ] **Step 6: Run deployed smoke tests**

Test the generated `workers.dev` staging URL for storefront browsing, checkout failure on empty
catalog, Admin login, authenticated and unauthenticated APIs, D1 reads/writes, R2 upload/read/delete,
security headers, and `noindex`. Do not add products or accept orders from outside the test team.

- [ ] **Step 7: Prepare Namecheap DNS without changing it**

Open Namecheap only when the user is present and signed in. Inspect the current DNS records for
`tkteck.it.com`, document conflicts, and propose the exact record change. Do not delete, replace, or
publish DNS records until the user explicitly approves the public launch after staging review.

- [ ] **Step 8: Commit staging configuration**

```bash
git add wrangler.jsonc scripts/verify-cloudflare-build.mjs .gitignore .openai/hosting.json docs/KHT-local-admin-and-deployment.md
git commit -m "chore: configure private Cloudflare staging"
```

### Task 11: User acceptance and separately approved public launch

**Files:**

- Modify: `wrangler.jsonc`
- Modify: `nuxt.config.ts`
- Modify: `docs/KHT-local-admin-and-deployment.md`

**Interfaces:**

- Consumes: approved staging build and final business contact values.
- Produces: production Worker, production D1/R2 resources, and approved `tkteck.it.com` route.

- [ ] **Step 1: Collect launch-only business values**

Require the final customer-service email, phone or WhatsApp number, shipping zones/rates, final
products/images/stock, and a new production Admin password. Keep the public launch blocked if any
required value is missing.

- [ ] **Step 2: Obtain explicit user acceptance of staging**

Present the staging URL and a short acceptance checklist. The user must explicitly approve the
storefront, checkout, Admin operations, policy copy, and production publication.

- [ ] **Step 3: Create clean production resources**

Create `kht-commerce-production` and `kht-product-media-production`, configure production-only
bindings and secrets, and apply migrations `0001` through `0007` without demo seeds.

- [ ] **Step 4: Load user-supplied production catalog and configuration**

Use Admin to add final products, images, stock, and shipping. Verify storefront totals and one
controlled COD order, then cancel that order and confirm inventory restoration.

- [ ] **Step 5: Deploy the exact accepted source revision**

Build once from the accepted commit, verify the Worker entrypoint, deploy production, and smoke test
the production Worker URL before changing DNS.

- [ ] **Step 6: Attach the custom domain only after publication approval**

Use the Cloudflare custom-domain flow and the user's Namecheap DNS session to attach
`tkteck.it.com`. Preserve unrelated DNS records, verify HTTPS, then enable production indexing only
after the domain, policies, contact channels, checkout, Admin, D1, and R2 all pass smoke tests.

- [ ] **Step 7: Record rollback and final verification**

Document the deployed Worker version and previous known-good version. Verify storefront, one test
checkout, tracking, Admin login, media, security headers, and logout. If any critical check fails,
restore the previous Worker version and leave DNS pointing only at a healthy deployment.

- [ ] **Step 8: Commit production deployment metadata**

```bash
git add wrangler.jsonc nuxt.config.ts docs/KHT-local-admin-and-deployment.md
git commit -m "chore: record KHT production deployment"
```
