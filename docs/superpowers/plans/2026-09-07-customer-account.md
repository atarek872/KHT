# Customer account implementation plan

Goal: add secure customer accounts, owned orders and durable carts to the existing Nuxt/D1 storefront, then deploy the verified build.

Architecture: preserve existing services, server-authoritative pricing, inventory triggers and bilingual design. Customer identities remain separate from phone-matched commerce customer records. Existing abandoned-cart storage becomes the durable cart repository. Checkout uses the existing createOrder transaction, with ownership, shipping snapshots, cart conversion and history recorded atomically.

- [ ] Identity: salted password hashes, opaque expiring sessions, CSRF and rate limiting, profile, addresses, password change and single-use reset with Cloudflare Email Service. Verify crypto, ownership, expiry and revocation.
- [ ] Carts: add user ownership, optimistic version checks, idempotent guest merge, configuration for abandonment and recovery contact snapshots. Verify concurrent writes, merge retries, repricing and no cross-user access.
- [ ] Orders: owned queries and pagination, immutable shipping snapshots, actual status history and admin transitions. Verify conversion rollback, stock reservation and single restock on cancellation/return.
- [ ] Frontend: account forms/navigation, responsive bilingual profile/addresses/orders/tracker; serialized cart sync and login restoration; existing checkout gains durable COD ordering while guest demo remains available.
- [ ] Validation: run unit and migration tests, typecheck, Cloudflare build, local HTTP journey registration through tracking including guest and authorization failures.
- [ ] Publish: preserve existing Sites access, provision DB binding/migrations, publish exact tested source and verify deployment. Configure Cloudflare email only with available authorized credentials; report any external setup blocker accurately.

Rulings: implementation and production publication are explicitly authorized. Work on codex/customer-accounts while preserving unrelated .env.example edits. No external provider payments invented: COD remains the existing payment method. Do not claim mail delivery without configured Cloudflare sender/token.
