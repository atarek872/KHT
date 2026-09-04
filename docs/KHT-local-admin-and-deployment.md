# KHT Local Development, Admin Access, and Deployment

## Local Development

Because `registry.npmjs.org` is blocked in the current Windows hosts file, install through Yarn's registry:

```powershell
npm ci --registry=https://registry.yarnpkg.com --replace-registry-host=always
npm run typecheck
npm test
npm run test:migration
npm run build
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

This runs the storefront, but full Admin persistence requires D1/R2 bindings.

## Full-Access Admin

The application currently has one Admin role, which already has full access. Generate your own strong password hash:

```powershell
npm run admin:hash-password -- "YOUR-STRONG-PASSWORD"
```

Never commit the output. Configure:

```env
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD_HASH=PASTE_GENERATED_HASH
```

Apply the six migrations:

```bash
for file in server/db/migrations/*.sql; do
  npx wrangler d1 execute kht-commerce --remote --file="$file" --yes
done
```

Then configure Cloudflare bindings:

```text
DB             -> Cloudflare D1 database
PRODUCT_MEDIA  -> Cloudflare R2 bucket
```

Admin URL:

```text
https://yourdomain.com/admin/login
```

## Ubuntu and Docker

The full application cannot currently run correctly as a normal Node Docker container. Admin services directly require Cloudflare runtime bindings:

- D1 for database storage
- R2 for images
- `context.cloudflare.env`

A Node container can run the storefront fallback, but Admin APIs will return `503`.

For the current architecture, deploy to Cloudflare:

```bash
npm ci
npm run typecheck
npm test
npm run build:cloudflare
npx wrangler deploy .output/server/index.mjs --assets .output/public
```

For genuine Ubuntu Docker Compose deployment, the project first needs storage adapters replacing:

```text
D1 -> PostgreSQL
R2 -> S3-compatible storage such as MinIO
```

The resulting production stack would be:

```text
Nginx
Nuxt Node container
PostgreSQL
MinIO
```

Using `wrangler dev` inside Docker is not recommended for production because it is a development runtime. Also note that Paymob and order-status transitions are not implemented yet, so the application should not accept live commercial payments.
