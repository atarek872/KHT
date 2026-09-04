# KHT audit fixes — 4 September 2026

Scope: the nine approved P2/P3 findings, followed by restrained simplification, motion and polish. Existing BLACK. WHITE. LINE tokens, fonts and commerce demo boundary are preserved. The requested distill, animate and polish skill packages were unavailable; the pass used frontend-design and storefront guidance directly.

## Resolved findings

- P2: retain checkout draft in Nuxt application state across bag edits; clear on completion. No personal data is persisted to cookies, storage or the server.
- P2: repair the browser Unicode-sets phone pattern; require 7–15 digits, accept common separators and Arabic digits, and associate a localized error with the field.
- P2: search category names and synonyms in both languages; normalize punctuation, spaces and Arabic diacritics.
- P2: give keyboard focus a white outline with a black outer ring for both light and dark surfaces.
- P2: use a 1200px image dialog with the 1086px source, a keyboard-scrollable viewing area and a fit toggle.
- P2: show the delivery-inclusive total directly above the final action on all screen sizes.
- P2: replace rendered PNGs with responsive WebP sources; retain original assets for regeneration.
- P3: localize error pages, direction and recovery in Arabic and English; use a main landmark.
- P3: reserve the campaign photograph for the home hero; give Drop a full tracksuit presentation, About the tee, and the closing section a white line composition.

## Finishing pass

Remove meaningless manifesto numbering, shorten checkout instructions, add input names, keep dialog headings accessible while scrolling, contain overlay scroll, account for the sticky header when focusing controls, and replace category padding animation with a white line drawn using transform. Mirror panel entrance motion in RTL and retain reduced-motion overrides.

## Verification

- Regression tests reproduce the original invalid phone constraint and missing T-shirt/category search, then pass with the fixes.
- Browser: search T-shirt returns the tee; image dialog is 1200px with a 1086px image; fit mode works; the keyboard CTA has both focus colors.
- Browser: checkout sample details survive bag edit and return; alphabetic phone is blocked; valid phone completes the demo and clears the bag.
- Browser: mobile final total touches the action block; Arabic 404 recovery works; Drop at 320px has no horizontal overflow and loads responsive images.
- No live commerce integration or real transaction was introduced.
