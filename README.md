# KHT — Black. White. Line.

Nuxt 4 bilingual fashion storefront and operations Admin for guest cash-on-delivery commerce on
Cloudflare Workers, D1, and R2.

## What works

- Responsive English/Arabic storefront, category collections, search, product variants, and a
  cookie-persisted bag.
- Guest COD checkout with server-owned price, discount, shipping, stock, and duplicate-submit
  validation.
- Durable order confirmation and private reference-plus-phone tracking.
- Customer CRM records created from checkout; no customer account or password is required.
- Operable order status workflow, one-time cancellation restock, explicit returned-item restock,
  and audit history.
- Product create/edit, image media, inventory, deactivate/reactivate, discounts, shipping, and
  categories.
- Contactable abandoned carts with manual WhatsApp/email recovery states and activity history.
- D1-backed rate limits, JSON/body-size guards, same-origin Admin actions, secure cookies, and
  restrictive browser headers.
- Original bilingual COD, shipping, exchange, privacy, and terms copy with configurable public
  customer-care channels.

## Full local runtime

Requires Node.js 22 or newer.

```powershell
npm ci
npm run admin:hash-password -- "YOUR-LOCAL-ONLY-PASSWORD"
```

Put `ADMIN_EMAIL` and the generated `ADMIN_PASSWORD_HASH` in an ignored `.dev.vars`, then run:

```powershell
npm run local:setup
npm run local:dev
```

Open `http://127.0.0.1:8787` or `http://127.0.0.1:8787/admin/login`.

## Verification

```powershell
npm test
npm run test:migration
npm run test:production-readiness
npm run typecheck
npm run build:cloudflare
```

The Cloudflare build stages the Worker at `dist/server/index.js` and assets at `dist/client`.
Deployment must use isolated staging and production resources. Never execute the local demo seed
against a remote D1 database.

For the complete local checklist, secret rotation, launch gates, and rollback procedure, see
[KHT Local Admin and Cloudflare Deployment](docs/KHT-local-admin-and-deployment.md).

## Structure

- `app/` — storefront and Admin UI.
- `server/api/` — Cloudflare Worker API routes.
- `server/services/` — commerce and operations rules.
- `server/db/migrations/` — forward-only D1 schema.
- `server/db/seeds/` — local-only fixtures.
- `shared/` — shared commerce types and utilities.
- `tests/` — unit, integration, migration, security, UI-source, and production-readiness tests.
