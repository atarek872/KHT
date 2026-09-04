# KHT Production Commerce Design

**Date:** 2026-09-05  
**Status:** Approved direction; awaiting final specification review  
**Deployment target:** Cloudflare Workers, D1, and R2  
**Initial payment method:** Cash on delivery (COD)

## Objective

Turn the existing KHT concept storefront into a durable COD commerce application that can be
tested safely on a production-like Cloudflare environment. The release must create real orders,
maintain customer and inventory records, let an administrator operate the order lifecycle, and
make abandoned carts actionable when the visitor has supplied contact information.

## Release Boundaries

The first release includes:

- Guest checkout with COD only.
- Durable customers, orders, line items, discounts, shipping rates, and inventory in D1.
- Product media in R2.
- Admin order status controls and an immutable status history.
- Contactable and anonymous abandoned-cart tracking.
- Manual WhatsApp and email recovery actions when contact data exists.
- Product activation and deactivation controls.
- KHT-specific delivery, return, privacy, and terms pages.
- A private staging deployment followed by a separately approved public deployment.

The first release does not include:

- Customer registration, customer passwords, or a customer account dashboard.
- Card or online payments.
- Automated email, SMS, or WhatsApp delivery.
- A self-service returns portal.
- VPS, Docker, PostgreSQL, or MinIO deployment.
- Remote backup automation beyond Cloudflare's platform facilities.

## Runtime Architecture

The Nuxt application is built as a Cloudflare Worker. Dynamic commerce data is stored in a D1
database through the existing `DB` binding. Product uploads are stored in an R2 bucket through the
existing `PRODUCT_MEDIA` binding. Admin credentials remain Worker secrets and are never committed
to source control.

The application will have two Cloudflare environments:

- Staging uses a separate D1 database and R2 bucket, sample data, `noindex`, and restricted access.
- Production uses its own empty D1 database and R2 bucket. Demo seed data is never applied there.

The first production domain is `tkteck.it.com`. DNS is attached to the Worker only after staging
passes the acceptance checks and the user explicitly approves public release.

## Guest Checkout and Order Creation

The storefront continues to use guest checkout. A shopper is not required to register or sign in.
The checkout collects the minimum fulfillment data: full name, phone, optional email, governorate,
city, street address, and order notes when useful.

The browser sends an idempotency key, cart identifier, selected variants, quantities, customer
details, shipping governorate, and optional coupon code. The server ignores browser-supplied prices
and calculates every amount from current D1 product, inventory, discount, and shipping records.

On successful submission, one atomic D1 operation:

1. Validates active products, variants, stock, shipping, and discount eligibility.
2. Normalizes the phone number and upserts a customer using that phone as the initial identity key.
3. Creates the order and line items using a unique idempotency key.
4. Reserves inventory exactly once.
5. Records discount usage when applicable.
6. Marks the matching cart as converted.
7. Creates the first order-history event.

Repeated submissions with the same idempotency key return the existing order instead of creating a
duplicate. A successful response contains a public order reference but never exposes internal
database identifiers or admin-only data.

The confirmation page loads the persisted order by its public reference. The order-tracking page
requires both the reference and the normalized phone number.

## Customer Records

The Customers area is an operational CRM, not a customer-login system. Customer records are
created from successful storefront checkouts or orders entered manually by an administrator.

Phone number is the primary matching field for the first release. A repeat order updates the
customer's current contact and delivery information while preserving every historical order. Email
is optional because COD fulfillment primarily depends on a reachable phone number.

Admin customer pages show contact information, order history, order count, last-order date, and
recognized revenue. They do not imply that the customer has an online account.

## Order Lifecycle

Fulfillment transitions are enforced on the server rather than only in the interface:

- `pending` can move to `confirmed` or `cancelled`.
- `confirmed` can move to `processing` or `cancelled`.
- `processing` can move to `shipped` or `cancelled`.
- `shipped` can move to `delivered` or `returned`.
- `delivered`, `cancelled`, and `returned` are terminal for the first release.

COD payment starts as `pending`. Marking an order delivered also marks COD payment as `paid` in the
same operation. Cancellation before shipping marks the payment as `failed` and restores reserved
inventory exactly once. A returned parcel is not automatically restocked; the administrator gets a
separate explicit restock action after inspecting the items.

Every status change writes an order event containing the old value, new value, timestamp, admin
identity, and an optional note. The admin detail page displays the available next actions, prevents
duplicate submission, refreshes after success, and shows the event timeline. Invalid or stale
transitions return a conflict response and do not partially update the order.

## Product Activation

The closed native dialog must not be displayed. Modal layout styles apply only while the dialog has
the `open` attribute. The deactivation confirmation appears only after the administrator selects
Deactivate.

Deactivation removes the product and its variants from the storefront without deleting order
history. Inactive products remain visible in Admin and expose a Reactivate action. Reactivation is
allowed only when the product has at least one valid active variant. Both actions provide clear
success and failure feedback.

## Abandoned Carts

Cart contents continue to be associated with a long-lived random cart identifier. Anonymous cart
snapshots support aggregate operational metrics but cannot be contacted.

Once a shopper enters a valid phone number or email in checkout and leaves the field, a debounced
snapshot stores the contact data with the cart. Contact data is used for order fulfillment and
manual cart recovery as disclosed by the privacy page. Marketing consent is not inferred from this
operational data.

A non-converted cart appears in Admin after 30 minutes of inactivity. Its state is one of:

- `active`: abandoned and not yet handled.
- `contacted`: an administrator recorded a recovery attempt.
- `dismissed`: no further action is planned.
- `converted`: the shopper completed an order.
- `recovered`: an administrator linked a later order to the recovery effort.

Contactable carts show a WhatsApp deep link and an email link where the corresponding value exists.
Anonymous carts show product and value information but no fake recovery action. Every manual state
change is recorded with a timestamp and admin identity.

## Policies

The Emerald website is a business reference, not a text source to copy. KHT's pages will express the
same requested operating model in original language and will describe KHT's actual technology and
COD flow rather than Shopify, card processing, accounts, or third parties that KHT does not use.

The initial operating terms are:

- The customer may inspect the parcel while the courier waits and may refuse it at delivery while
  paying the applicable shipping charge.
- Exchanges may be requested within three calendar days after delivery.
- Exchange shipping is paid by the customer and follows the configured governorate rate.
- An exchange is limited to an available size, color, or another item of equal value.
- Items must be unused, unwashed, unaltered, with tags attached, and in original packaging.
- Customized or special-order products are not eligible.
- Delivery estimates are estimates and can be affected by the carrier or circumstances outside
  KHT's control.

The privacy page discloses collection of cart contents, contact details, delivery address, order
history, device/security data needed to operate the service, Cloudflare processing, retention,
security limitations, and customer access/correction/deletion requests. It does not claim that KHT
collects card details or maintains customer accounts.

Public launch is blocked until KHT supplies a real phone or WhatsApp number and a customer-service
email. Those values are runtime business configuration and must appear consistently in checkout,
order tracking, footer, and policy pages.

These pages are operational copy, not legal advice; the business owner remains responsible for a
local legal review before accepting public orders.

## Security and Abuse Controls

- Admin cookies are HTTP-only, same-site, and secure on HTTPS.
- Admin login, checkout submission, order tracking, and cart-contact updates receive rate limits.
- All mutations validate content type, body size, allowed values, and maximum field lengths.
- Checkout and status changes use idempotency or optimistic conflict handling.
- Public errors are actionable but do not expose SQL, secrets, or internal identifiers.
- Product uploads validate authentication, type, size, and generated object keys.
- Security headers prohibit framing and reduce content-type and referrer leakage.
- Secrets are configured in Cloudflare and excluded from Git and logs.

## Schema Changes

A new forward-only D1 migration extends the existing schema with:

- Public order reference fields and indexes.
- `returned` fulfillment state support.
- Inventory-restoration markers.
- `order_events` for audit history.
- Expanded abandoned-cart states and contact timestamps.
- `abandoned_cart_events` for recovery history.

The migration preserves existing local demo records. Migration and application logic must tolerate
old rows and must not require destructive database recreation.

## Failure Handling

Checkout failures leave the shopper's bag intact and explain whether stock, shipping, coupon, or
temporary service availability prevented submission. An unknown server error returns a retryable
message and a request identifier for logs.

Admin mutations remain disabled while in flight. A failed mutation leaves the displayed record
unchanged and offers a retry. D1 quota or availability errors fail closed for order creation: the
store must never show a successful order confirmation unless the durable transaction completed.

## Validation and Acceptance

Automated coverage must include:

- New migration application and data constraints.
- Server-enforced order transitions and rejected invalid transitions.
- One-time inventory reservation, cancellation restoration, and returned-item restocking.
- Checkout idempotency and server-side pricing.
- Customer creation and repeat-customer matching.
- Cart contact capture, abandonment timing, conversion, and recovery states.
- Closed product dialog behavior and activation/deactivation APIs.
- Authentication and authorization of every Admin mutation.

End-to-end acceptance covers one complete COD purchase, Admin confirmation through delivery,
customer history, cancellation with inventory restoration, contactable and anonymous abandoned
carts, product deactivate/reactivate, media upload, order tracking, and logout.

The staging deployment must pass the full automated suite, typecheck, production build, migration
dry run, and deployed smoke tests. Public DNS is changed only after the user reviews staging and
supplies the required business contact values.

## Deployment and Access

Deployment uses the user's Cloudflare account with separate staging and production resources. The
user signs into Cloudflare and Namecheap directly in the browser; credentials are not sent through
chat or stored in the repository. The previously shared VPS credentials are outside this deployment
path and must be rotated.

The rollout sequence is:

1. Build and verify locally against local D1 and R2 emulation.
2. Create staging Worker, D1, R2, secrets, and migrations.
3. Deploy staging and complete smoke and acceptance tests.
4. Add final products, stock, shipping, policy contact values, and a new production admin secret.
5. Create clean production D1 and R2 resources and apply migrations without demo seeds.
6. Attach `tkteck.it.com` only after explicit approval for a public launch.

