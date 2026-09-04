# KHT admin setup

The admin commerce workflow uses Cloudflare D1 and R2. The Worker must have a D1 binding named
`DB` and an R2 bucket binding named `PRODUCT_MEDIA`.

## Database

Create a D1 database, bind it to the deployed Worker as `DB`, then apply:

```sh
npx wrangler d1 execute kht-commerce --remote --file=server/db/migrations/0001_commerce.sql
npx wrangler d1 execute kht-commerce --remote --file=server/db/migrations/0002_products.sql
npx wrangler d1 execute kht-commerce --remote --file=server/db/migrations/0003_categories.sql
npx wrangler d1 execute kht-commerce --remote --file=server/db/migrations/0004_discounts.sql
npx wrangler d1 execute kht-commerce --remote --file=server/db/migrations/0005_abandoned_carts.sql
npx wrangler d1 execute kht-commerce --remote --file=server/db/migrations/0006_commerce_safety.sql
```

The migration creates durable customers, variants, inventory, shipping zones, orders, order
items, and admin sessions. Initial shipping rates are Cairo 60 EGP, Giza 70 EGP, and Alexandria
90 EGP. Inventory triggers reject unavailable stock and decrement accepted quantities in the same
D1 batch as order creation.

## Admin credentials

Generate a PBKDF2 password hash locally. Do not commit the password or generated hash.

```sh
npm run admin:hash-password -- "your password"
```

Configure `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` as Worker secrets/environment variables. Admin
sessions use an HTTP-only, SameSite=Strict cookie and expire after eight hours.

## Runtime boundary

The storefront checkout remains a demo. Admin Create Order writes durable COD orders to D1. Manual
Paymob creation is intentionally unavailable because no verified manual Paymob workflow exists.