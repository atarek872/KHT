# KHT Local Admin and Cloudflare Deployment

KHT is a Nuxt 4 Cloudflare Worker. The complete application uses Cloudflare D1 for commerce data
and R2 for product media. The local Wrangler runtime emulates both services, so local testing does
not require a Cloudflare account, Docker, PostgreSQL, MinIO, or the VPS.

## First local setup

Use Node.js 22 or newer, then install dependencies:

```powershell
npm ci
```

Generate a password hash. The command prints a hash, not the password:

```powershell
npm run admin:hash-password -- "YOUR-LOCAL-ONLY-PASSWORD"
```

Create an ignored `.dev.vars` file in the repository root:

```env
ADMIN_EMAIL=admin@kht.local
ADMIN_PASSWORD_HASH=PASTE_GENERATED_HASH
```

Prepare the database and start the full application:

```powershell
npm run local:setup
npm run local:dev
```

Open:

- Storefront: `http://127.0.0.1:8787`
- Admin: `http://127.0.0.1:8787/admin/login`

`local:setup` applies all seven migrations in order, then inserts repeatable local test fixtures.
Running it again does not duplicate seeded records. Local D1 and R2 data lives below `.wrangler/`
and is ignored by Git.

## Manual acceptance checklist

The local seed includes seven COD orders covering pending, confirmed, processing, shipped,
delivered, cancelled, and returned states; it also includes contactable, anonymous, recent, and
recovered carts.

1. Sign in at `/admin/login` and confirm the dashboard loads.
2. Open Orders, select the pending order, and move it through the available next status. Only valid
   state transitions should appear.
3. Open the returned order. Use the explicit restock action only after inspection; the action must
   disappear after one successful restock.
4. Open Products. Deactivate a product, confirm the dialog only appears after the click, and then
   reactivate it. Its variants and stock must remain unchanged.
5. On the storefront, add a product and place a COD order with a new Egyptian mobile number. The
   confirmation must show a durable reference and server-calculated totals.
6. Track that order at `/track-order` using the reference and the same phone number. A different
   phone number must not reveal it.
7. Return to Admin. The order must appear in Orders and the checkout person must appear in
   Customers without any customer registration or password.
8. Start another checkout, enter a valid phone or email, wait at least one second, and leave without
   ordering. After the 30-minute abandonment threshold, the cart is eligible for WhatsApp/email and
   manual contacted, recovered, or dismissed actions. An anonymous cart shows value and items but
   no contact action.
9. Upload and remove a test product image, then verify the storefront still renders the selected
   image through the media endpoint.
10. Log out and verify direct Admin API/page access asks for authentication again.

## Automated verification

Run these commands before staging or production:

```powershell
npm test
npm run test:migration
npm run test:production-readiness
npm run typecheck
npm run build:cloudflare
npm run verify:cloudflare-build
npx wrangler deploy --env staging --dry-run
```

The readiness test covers durable COD creation, CRM identity matching, delivery and payment status,
audit history, cancellation inventory restoration, abandoned-cart recovery, product activation,
and Admin authentication requirements.

## Local data and fixture rules

- `server/db/seeds/local-demo.sql` is for local testing only.
- Production and staging must never run the demo seed or copy the local `.wrangler/` directory.
- The migrations bootstrap the three current starter products and their inventory, but do not add
  demo customers, carts, or orders. Replace the starter catalog with the accepted final catalog
  before a public production launch.
- Production receives forward-only migration files from `server/db/migrations/` and final catalog
  data entered after deployment.
- A cancelled order restores reserved stock once. A returned order restores stock only after the
  separate inspection/restock action.

## Admin secret rotation

Generate a new password and hash for every environment. Never reuse the local password for staging
or production, and never commit a password, hash, API token, or `.dev.vars` file. Update the
Cloudflare secrets `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH`, deploy, verify the new login, then end
old browser sessions if required.

The generator uses 100,000 PBKDF2-SHA256 iterations, which is the maximum accepted by the
Cloudflare Workers Web Crypto runtime. Do not raise the iteration count without verifying it on a
deployed Worker; a higher Node-compatible value can make Admin login fail only at the edge.

## Private staging deployment

The private staging environment is deployed at:

- `https://kht-commerce-staging.atarek872.workers.dev`

It uses the isolated `kht-commerce-staging` D1 database and
`kht-product-media-staging` R2 bucket. All seven migrations are applied. The local demo seed was
not applied. Preview URLs are disabled and indexing is set to `noindex, nofollow`.

Cloudflare Access protects all Worker traffic before the application runs. Its allow policy is
limited to members of this Cloudflare account, which currently means the account owner. Testing
therefore has two distinct sign-ins: first Cloudflare Access, then the KHT Admin login at
`/admin/login`. Do not remove Access protection or attach the public domain during staging review.

## Staging and production gates

Staging and production require separate D1 databases, R2 buckets, Admin secrets, and hostnames.
Staging remains `noindex` and should be protected with Cloudflare Access. Do not attach
`tkteck.it.com` during staging.

Before public production launch, all of the following are required:

- final customer-service email and phone or WhatsApp number;
- final shipping zones and rates;
- final products, images, variants, and stock;
- acceptance of storefront, checkout, Admin operations, and policy copy;
- a clean production D1/R2 setup with migrations only;
- an explicit approval to change DNS and publish the domain.

Indexing stays disabled unless `NUXT_PUBLIC_STORE_INDEXING_ENABLED=true` is deliberately configured
for the accepted production release.

## Rollback

Record the deployed Cloudflare Worker version and the previous known-good Worker version at every
release. If a critical smoke test fails, restore the previous version from Cloudflare deployment
history, verify storefront and Admin health, and keep DNS pointed only at a healthy deployment.
Database migrations are forward-only; do not delete production tables or restore local demo data as
a rollback shortcut.

## Why the VPS is not used

The current code depends directly on Worker bindings at `event.context.cloudflare.env`. A standard
Node Docker container would need new PostgreSQL and S3-compatible adapters. The approved deployment
uses Cloudflare Workers, D1, and R2, so the VPS is not part of this release path.
