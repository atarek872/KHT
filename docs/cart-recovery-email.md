# Cart recovery email

The production Worker checks opted-in abandoned carts on the existing five-minute cron. It sends a bilingual reminder after one hour of inactivity and a different reminder after 24 hours. A cart that is cleared, converted to an order, dismissed, or unsubscribed is not mailed. Each stage has one durable outbox row and retries without logging recipient addresses or provider credentials.

## Activation

Use an email marketing service account that allows abandoned-cart messages. The current integration uses Brevo's email API. Verify a KHT sender domain/address in Brevo, then store `BREVO_API_KEY` and `BREVO_SENDER_EMAIL` as **production Cloudflare Worker secrets**. `PUBLIC_SITE_URL` must be the HTTPS storefront origin. The checkout opt-in only appears when these settings exist. Test a single consenting address and verify receipt before activating customer traffic.

Do not use Cloudflare Email Service's `EMAIL` or `ALERT_EMAIL` binding for these marketing messages. Those bindings are reserved for password reset and owner alerts. Never put provider keys in `NUXT_PUBLIC_*` variables or the repository.

The opt-in is unchecked by default and is recorded with the cart and email. Each email includes a recovery link that restores product selections at current stock and prices, the published Instagram contact link, and a self-service unsubscribe link. Tokens travel in URL fragments and expire after 30 days.

Existing production carts have no recorded marketing permission and are **not** enrolled by the migration. If permission was collected elsewhere, verify and record its source before enrolling those specific carts. A consent recorded after a cart is already more than an hour old permits one immediate reminder and a second one no sooner than 24 hours later.
