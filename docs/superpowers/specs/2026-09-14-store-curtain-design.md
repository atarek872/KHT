# Store Curtain Design

## Goal

Give the administrator one safe control in **Settings → Store availability** that can temporarily cover every customer-facing page with a polished monochrome launch or maintenance screen. The admin area remains available so the curtain can always be edited or disabled.

## Experience

- The setting is disabled by default and the store behaves exactly as it does today.
- When active, the storefront remains rendered behind an opaque black layer with a strong blur, but it cannot be focused, clicked, or scrolled.
- The curtain displays bilingual title and supporting copy, an optional grayscale image, an optional countdown, and an optional link.
- Presets provide “Coming Soon” and “Under Construction”; custom mode supports any campaign message.
- A countdown uses an absolute date and time entered in Cairo time. It can automatically reveal the store when it reaches zero.
- Visitors cannot dismiss the curtain. The welcome gift does not compete with it.
- Active customer pages return a temporary 503 response with `Retry-After` when a future launch time exists and use `noindex, nofollow`, so search engines understand the interruption is temporary.

## Data and API

A singleton `store_curtain_settings` D1 row stores enabled state, mode, bilingual content, image URL, countdown and link configuration, plus the last admin and update timestamp.

- `GET /api/admin/store-curtain` returns the full editable record and effective live state.
- `PUT /api/admin/store-curtain` validates and saves the record. Both admin endpoints require the existing secure admin session.
- `GET /api/storefront/store-curtain` exposes only the content needed by visitors and returns `null` when the curtain is disabled or an auto-open countdown has expired.

Uploaded images reuse the existing authenticated R2 media API. Media reference checks include the curtain image so an active asset cannot be deleted accidentally.

## Safety and accessibility

- Titles, messages, labels, URLs, and dates are length and format validated on the server.
- Curtain images must use the existing `/api/media/` path. Links allow safe store-relative paths or HTTPS destinations only.
- The hidden store wrapper becomes inert and aria-hidden while active. Focus moves to the curtain, which is announced as a modal dialog.
- Countdown values have visible labels and a stable screen-reader description rather than announcing every second.
- The page is responsive, respects reduced motion, uses the current black-and-white design language, and uses Impact only for the display headline.
