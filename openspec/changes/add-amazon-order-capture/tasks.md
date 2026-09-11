## 1. Manifest registration

- [x] 1.1 In `manifest.json`, add static `host_permissions` for `https://www.amazon.es/*` and the Amazon image CDNs: `https://m.media-amazon.com/*`, `https://images-eu.ssl-images-amazon.com/*`, `https://images-na.ssl-images-amazon.com/*`.
- [x] 1.2 Add a `content_scripts` entry matching `https://www.amazon.es/*` that loads the existing `content/content.js` at `document_idle` (the adapter gates actual injection to order pages).
- [x] 1.3 Add `stores/amazon.js` to `web_accessible_resources` with a `matches` of `https://www.amazon.es/*`.

## 2. Amazon store adapter

- [x] 2.1 Create `stores/amazon.js` exporting `amazonAdapter` with `id: 'amazon'` and `matches(url)` returning true for `amazon.es` order pages (`order-history`, `your-orders`, `order-details` path fragments, tolerating the `/-/en/` locale prefix).
- [x] 2.2 Implement `findCards(root)` returning the union of order-history list item rows (`.order-card .a-fixed-left-grid.item-box`) and order-details item rows (each `[data-component="purchasedItems"] [data-component="itemTitle"]` resolved to its enclosing `.a-fixed-left-grid` row), de-duplicated.
- [x] 2.3 Implement `getButtonMount(card)` returning `.yohtmlc-item-level-connections` (list) or `[data-component="itemConnections"]` (details), falling back to the card itself.
- [x] 2.4 Implement `extract(card)` for the details layout: description ← `[data-component="itemTitle"] a` text; image ← `[data-component="itemImage"] img` (`data-a-hires` then `src`); productLink ← the title link; supplierName ← `[data-component="orderedMerchant"] a` text (default "Amazon"); price/currency ← `[data-component="unitPrice"] .a-offscreen` via `parsePrice`; reference ← ASIN.
- [x] 2.5 Implement `extract(card)` for the list layout: description ← `.yohtmlc-product-title a` text; image ← `.product-image img` (`data-a-hires` then `src`); productLink ← that link; supplierName default "Amazon"; price `null`; reference ← ASIN.
- [x] 2.6 Add helpers: `asinFrom(link)` (match `/dp/<ASIN>` or `/gp/product/<ASIN>`, 10 chars); `normalizeProductLink(link)` → `https://www.amazon.es/dp/<ASIN>` when an ASIN is present; `upscale(url)` stripping the Amazon size token via `url.replace(/\._[^/]+?_(\.[a-z]+)$/i, '$1')`. Return the `{ store: 'amazon', description, imageUrl, productLink, supplierName, price, currency, reference }` shape.

## 3. Register the adapter & generalize the content script

- [x] 3.1 In `content/main.js`, import `amazonAdapter` and add it to the `ADAPTERS` array.
- [x] 3.2 Generalize the `MutationObserver` re-injection: remove the AliExpress-only `node.matches('.order-item')` fast-path and rely on `injectAll(node)` (active adapter's `findCards`) so Amazon's dynamically rendered rows also get buttons; keep the `data-dps-injected` idempotency guard.

## 4. Store-agnostic supplier fallback

- [x] 4.1 In `background/service-worker.js` `createPart`, replace the hard-coded `data.supplierName || 'AliExpress'` fallback with one derived from the captured `data.store` (e.g. capitalized store id), so an Amazon Part with an empty seller falls back to "Amazon".

## 5. Docs

- [x] 5.1 Update `README.md` to document Amazon support: supported `amazon.es` order pages (order-history/your-orders list and order-details), that the list page has no per-item price/seller (fill in the dialog), and the added Amazon host permissions.

## 6. Manual verification

- [ ] 6.1 Reload the unpacked extension and accept the new Amazon host permissions.
- [ ] 6.2 On an `amazon.es` order-history / your-orders list, verify each product row shows both buttons, including after scrolling/paginating, with no duplicates and none on non-order pages.
- [ ] 6.3 On an `amazon.es` order-details page, verify each purchased item shows both buttons and that `extract` captures description, upscaled image, `/dp/<ASIN>` link, ASIN reference, unit price, and "Sold by" seller.
- [ ] 6.4 Add a Tool from the list page and confirm the item + photo are created and the item is tool-capable.
- [ ] 6.5 Add a Part from the details page and confirm the item, photo, supplier (seller name), and buying link (price + ASIN reference) are created; verify a Part captured from the list page lets you fill in the missing price before saving.
