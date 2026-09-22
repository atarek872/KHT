# Admin Permanent Deletion Design

## Goal

Add small, deliberate permanent-delete controls for orders, abandoned carts, and exact inventory variants in the existing KHT Admin. The controls must remove the selected record completely while preserving stock correctness, historical order readability, and the existing Admin security model.

## Scope

This change adds:

- permanent deletion of eligible orders;
- permanent deletion of abandoned carts;
- permanent deletion of exact inventory variants;
- desktop and mobile delete controls in the relevant Admin list and detail views;
- protected `DELETE` endpoints and service methods;
- clear confirmation, success, rejection, loading, and empty states;
- regression coverage for database integrity, authorization, and responsive UI.

It does not add bulk deletion, scheduled cleanup, customer deletion, product hard deletion, or automatic deletion of related historical orders.

## Chosen Approach

Use guarded hard deletion. Records are physically removed from D1, but destructive operations are rejected when deleting them would corrupt stock or historical order data. This gives the requested complete deletion without adding a recoverable trash layer.

An unrestricted cascading delete was rejected because it could remove valid sales history and silently change inventory. Soft deletion was rejected because the requested record would remain in the database.

## Order Deletion

### Eligibility

An order can be permanently deleted only when its fulfillment status is one of:

- `cancelled` and its reserved inventory has already been restored;
- `delivered`;
- `returned` and returned inventory has already been explicitly restocked.

Orders in `pending`, `confirmed`, or `processing` must use the existing cancellation transition first. That transition remains responsible for restoring reserved stock exactly once. Orders in `shipped` or `out-for-delivery` cannot be deleted while fulfillment is active.

The delete operation never changes inventory. This avoids hidden stock changes and keeps inventory restoration in the existing audited transition service.

Deleting an order also removes its customer discount redemption and customer order-history entry. A customer may therefore become eligible again for a first-order or once-per-customer discount. The confirmation dialog states this consequence explicitly.

### Database behavior

Before deleting the order, the service verifies the current fulfillment status and restoration timestamps. It clears nullable references from abandoned carts that point to the order. Existing foreign-key cascades remove order items, events, status history, and customer discount redemption records. The customer record remains.

The reference cleanup and guarded delete run in one D1 batch. A concurrent state change causes the guarded delete to affect zero rows and the service reports a conflict.

### Admin interface

- Add a small trash action to each eligible order in desktop and mobile order lists.
- Add `Delete permanently` to the order detail actions.
- The confirmation dialog displays the order number and explains that the action cannot be undone.
- The confirmation requires the Admin to type the exact order number.
- After success, list deletion refreshes in place; detail deletion returns to `/admin/orders` with a success notice.
- Ineligible orders keep their normal fulfillment actions and show deletion guidance in the detail view.

## Abandoned Cart Deletion

### Database behavior

An Admin may permanently delete an abandoned cart shown in the recovery interface. The service removes dependent cart items, recovery events, and merge receipts before deleting the cart. If an order currently references the cart, deletion is rejected to preserve the order relationship.

The delete does not affect inventory because abandoned carts do not reserve stock.

### Admin interface

- Add a small trash action to every desktop row and mobile card.
- Add `Delete permanently` to the abandoned-cart detail page.
- Use the existing confirmation dialog with the customer name or `Anonymous cart` and a permanent-deletion warning.
- After success, list deletion refreshes in place; detail deletion returns to `/admin/abandoned-carts` with a success notice.

## Inventory Variant Deletion

### Eligibility and database behavior

The delete target is one exact variant row, identified by size, color, and SKU.

- Reject deletion when any historical `order_items` row references the variant.
- Remove the variant from active or abandoned cart item snapshots that still reference it.
- Recalculate each affected cart's subtotal and item count.
- Change an affected empty active cart to `cleared` so it no longer appears as an actionable abandoned cart.
- Delete the inventory variant.
- If the product has no remaining active variants, archive the product automatically so the storefront cannot display an unsellable product.

The service does not delete the parent product, product media, or historical order snapshots.

### Admin interface

- Add a small trash action to every inventory row and mobile inventory card.
- Confirmation identifies the product, color, size, and SKU.
- The dialog explains that the variant will also be removed from open carts.
- A referenced variant receives a clear rejection telling the Admin that historical orders still use it.
- Successful deletion refreshes the inventory list and announces the result.

## API and Security

Add these endpoints:

- `DELETE /api/admin/orders/:id`
- `DELETE /api/admin/abandoned-carts/:id`
- `DELETE /api/admin/inventory/:id`

Every endpoint must:

- call `requireAdmin(event)`;
- call `requireSameOrigin(event)`;
- validate a non-empty route identifier;
- use the existing D1 binding and service layer;
- return `404` for missing records, `409` for relationship or state conflicts, and a concise safe message;
- return only the deleted identifier and success state, without leaking database details.

No public or customer endpoint gains deletion capability.

## Shared UI Behavior

All delete buttons use the current monochrome Admin design. The icon has an accessible label and a minimum 44-pixel touch target even when it appears visually small. Buttons disable while a deletion is in progress. The existing `AdminConfirmDialog` is reused for carts and variants. Order confirmation extends the established dialog pattern with an exact-number input because deleting an order removes financial and fulfillment history.

Errors appear in an announced alert near the affected list or action area. Success appears in a status message and the deleted row disappears without a full page reload.

## Testing

Service tests will verify:

- eligible orders are deleted with dependent records;
- active or unsettled orders are rejected;
- order deletion does not alter inventory;
- abandoned carts and their dependent records are deleted;
- carts referenced by orders are rejected;
- unused variants are deleted and removed from open carts;
- affected cart totals and state are recalculated;
- variants referenced by historical orders are rejected;
- the parent product is archived when no active variant remains.

Route and security tests will verify Admin authentication, exact-origin checks, identifier validation, and safe status codes.

UI tests will verify desktop and mobile controls, accessible labels, confirmation copy, disabled loading states, navigation after detail deletion, and the absence of bulk-delete behavior.

The full existing test suite, typecheck, Cloudflare build verification, local visual review, and protected production-route checks must pass before deployment.

## Deployment

No migration is required because the existing foreign keys and status fields are sufficient. The implementation will be committed to `main`, deployed to the existing `kht-commerce-production` Worker, and verified on `https://kht-eg.com`.
