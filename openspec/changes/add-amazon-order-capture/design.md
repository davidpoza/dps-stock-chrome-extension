## Context

The extension already ships an AliExpress capture flow built around a small `StoreAdapter` interface (`stores/aliexpress.js`): `matches(url)`, `findCards(root)`, `getButtonMount(card)`, `extract(card)`. `content/main.js` picks the first adapter whose `matches` returns true, injects the two buttons per card, and drives everything through the confirmation dialog (`content/dialog.js`), toasts (`content/toast.js`), and the background service worker (`background/service-worker.js`), which is the only context that holds the API key and talks to the DPS Stock backend. This change adds a second adapter for Amazon; the dialog, toast, and create flows are reused unchanged.

Two saved Amazon `amazon.es` pages drove the selectors below:

**Order-history / your-orders list** (`amazon-lista-pedidos.html`, URL like `https://www.amazon.es/-/en/gp/css/order-history?...`) — an older markup using `yohtmlc-*` class hooks:
- Order card: `.order-card.js-order-card` (one per order; an order can contain several items).
- Item row: `.a-fixed-left-grid.item-box` (one per product; appears inside a `<li>`).
- Title: `.yohtmlc-product-title a` (text is the description; `href` is `.../dp/<ASIN>`).
- Image: `.product-image img` — `src` is a local thumbnail in the saved file, but `data-a-hires` holds the real CDN URL (`https://m.media-amazon.com/images/I/<id>._SS284_.jpg`).
- Item action area (button mount): `.yohtmlc-item-level-connections`.
- No per-item price and no per-item seller are shown on this page.

**Order-details** (`amazon-pedido-detalle.html`, URL like `https://www.amazon.es/your-orders/order-details?orderID=...`) — newer markup using `data-component` hooks, all under `[data-component="purchasedItems"]`:
- Item row: a `.a-fixed-left-grid` containing `[data-component="itemTitle"]`.
- Image: `[data-component="itemImage"] img` (`data-a-hires` = `https://m.media-amazon.com/images/I/<id>._SS568_.jpg`).
- Title/link: `[data-component="itemTitle"] a` (text + `.../dp/<ASIN>`).
- Seller: `[data-component="orderedMerchant"] a` (the "Sold by: <seller>" link text).
- Unit price: `[data-component="unitPrice"] .a-offscreen` (e.g. `€9.99`).
- Item action area (button mount): `[data-component="itemConnections"]`.

Backend behaviour, message API, settings, and the CORS-avoidance model are all unchanged from the AliExpress design and are not restated here.

## Goals / Non-Goals

**Goals:**
- Add `stores/amazon.js` implementing the existing `StoreAdapter` interface for both supported Amazon pages.
- Inject the existing Add Tool / Add Part buttons per purchased item, with the existing idempotency and dynamic-render handling.
- Capture description, image (full-resolution), product link, ASIN reference, and — on the details page — unit price and seller name.
- Register the extension on `amazon.es` order pages and grant the service worker access to Amazon image CDNs so photos can be fetched.
- Keep the content script and backend create flow store-agnostic so a third store stays cheap.

**Non-Goals:**
- Amazon marketplaces other than `amazon.es` (architecture leaves room; out of scope here).
- Capturing order-level data (order id, order total, shipping) — capture is per product only.
- Any backend change, new endpoint, or change to the dialog/toast UX.
- A build toolchain; stay on plain MV3 ES modules loadable unpacked.
- Deduplication or updating of items already in inventory (always creates new).

## Decisions

### 1. Two-layout adapter behind one `matches`
Amazon renders the list page and the details page with different markup (`yohtmlc-*` vs `data-component`), so `stores/amazon.js` detects which layout a given element belongs to and reads the corresponding selectors. `findCards(root)` returns the union of list item rows (`.order-card .a-fixed-left-grid.item-box`) and details item rows (`[data-component="purchasedItems"] [data-component="itemTitle"]`, walked up to their `.a-fixed-left-grid` row). `extract(card)` branches on which markers the row contains. *Alternative:* two separate adapters (`amazon-list`, `amazon-details`). Rejected — they share ASIN/image/upscale logic and the same buttons; one adapter with two selector sets keeps that logic in one place. *Alternative:* rely only on the details page. Rejected — the user browses the list page and wants to capture Tools (description + photo) directly from it.

### 2. Per-item capture, seller-and-price optional by page
The unit of capture is a single product, matching the Tool/Part = one item model and the AliExpress adapter. On the details page all fields are available; on the list page price and seller are absent, so `extract` leaves `price: null` and defaults `supplierName` to `"Amazon"`. The confirmation dialog already lets the user fill these in before saving, so a Part captured from the list page is still fully usable. *Rationale:* matches how Amazon exposes data without forcing a navigation to the details page.

### 3. Reference = ASIN; product link normalized to `/dp/<ASIN>`
The ASIN (10-char, from `/dp/<ASIN>` or `/gp/product/<ASIN>`) is Amazon's stable product identifier, so it is used as the `reference`/`supplierReference`. The captured product link is cleaned to `https://www.amazon.es/dp/<ASIN>` (stripping `ref=`/tracking query params and the `/-/en/` locale segment) so the stored buying link stays stable and short. *Alternative:* keep the raw href. Rejected — it carries volatile tracking tokens.

### 4. Amazon-specific image upscaling
Amazon encodes size in the filename via a `._<TOKEN>_` segment before the extension (`._SS284_`, `._AC_UL165_SR165,165_`). The adapter reads `data-a-hires` first (already a larger variant) and then strips the size token with `url.replace(/\._[^/]+?_(\.[a-z]+)$/i, '$1')` to request the original (e.g. `71mikXNUSQL._SS568_.jpg` → `71mikXNUSQL.jpg`). This is distinct from the AliExpress `_220x220` stripper, so it lives in the Amazon adapter rather than in `shared/price.js`/the AliExpress `upscale`. The service worker fetches whatever URL is captured; if the stripped URL 404s, photo upload already degrades to a non-fatal partial-success warning.

### 5. Manifest registration for Amazon
Add to `manifest.json`:
- `host_permissions`: `https://www.amazon.es/*` plus the Amazon image CDNs the service worker must fetch — `https://m.media-amazon.com/*`, `https://images-eu.ssl-images-amazon.com/*`, `https://images-na.ssl-images-amazon.com/*`.
- A content-script entry matching `https://www.amazon.es/*` that loads the existing `content/content.js` loader. Matching the whole host (rather than enumerating the many order-URL shapes, including the `/-/en/` locale prefix and `gp/css` vs `your-orders` variants) is simpler and robust; `content/main.js` already no-ops when no adapter's `matches` returns true, so injection only actually happens on order pages. The adapter's `matches` regex gates on `order-history`, `your-orders`, and `order-details` path fragments.
- `web_accessible_resources`: add `stores/amazon.js` under a `matches` of `https://www.amazon.es/*` so the module can be dynamically imported by `content/main.js`.

*Alternative:* narrow per-path content-script matches. Rejected — brittle given Amazon's URL variety; the broad host match with adapter-level gating is cheaper to maintain. *Alternative:* request Amazon hosts via `optional_host_permissions` at runtime. Rejected — the Amazon origins are known and static, so declaring them keeps setup zero-click.

### 6. Make the shared plumbing store-agnostic
Two small edits remove AliExpress-specific assumptions rather than duplicating them for Amazon:
- `content/main.js` `MutationObserver` currently fast-paths `node.matches('.order-item')`; generalize re-injection to call `injectAll(node)` / the active adapter's `findCards` so Amazon's dynamically rendered rows also get buttons. (`injectAll` already re-scans subtrees, so the AliExpress-specific line is redundant once removed.)
- `background/service-worker.js` `createPart` defaults the supplier name to the literal `'AliExpress'`; change the fallback to derive from the captured `data.store` (e.g. capitalized store id) so an Amazon Part with an empty seller falls back to "Amazon", not "AliExpress". The adapter also sets `supplierName` explicitly, so this fallback is a safety net.

## Risks / Trade-offs

- **Amazon markup changes / A-B layout variants** → scraping breaks or misses fields. *Mitigation:* all selectors live in the one adapter; `extract` degrades to empty fields (never throws), and the confirm-before-save dialog lets the user fix any bad capture. Both known layouts (`yohtmlc-*` list and `data-component` details) are handled.
- **Broad `https://www.amazon.es/*` content-script match** injects the tiny loader on all `amazon.es` pages, not just order pages → negligible overhead because `init()` bails immediately when no adapter matches; no buttons or observers are attached off order pages.
- **List page lacks price/seller** → a Part captured there is missing those fields. *Mitigation:* documented; the dialog is pre-opened for editing and the user can add them, or capture that item from the details page instead.
- **Image size-token stripping could over-strip an unusual URL** → a broken photo URL. *Mitigation:* `data-a-hires` is tried first; photo upload failure is already non-fatal (partial success), so the item is still created.
- **Locale prefix `/-/en/` and query tracking in links** → inconsistent references. *Mitigation:* normalize to `/dp/<ASIN>` and use the ASIN as the reference.

## Migration Plan

No migration or data change. Rollout: reload the unpacked extension (`chrome://extensions` → Reload) so the new manifest host permissions and content-script match take effect; Chrome will prompt to accept the added Amazon host permissions. Then open an `amazon.es` order-history or order-details page and use the buttons. Rollback = revert the change and reload the extension; no backend state is affected beyond items the user explicitly creates.

## Open Questions

- **Quantity → stock**: Amazon order-details exposes a per-item quantity (`[data-component="quantity"]`). Capture it into the Part `stock`, or leave stock unset as today? Default: leave unset in this change (consistent with the AliExpress flow).
- **Other Amazon TLDs**: extend `matches`/manifest to `.com`, `.de`, `.co.uk`, …? Default: `amazon.es` only now; add later on demand.
- **Seller vs "Amazon.es" as supplier**: when "Sold by" is Amazon itself, keep the literal seller text or normalize to "Amazon"? Default: use the captured seller text verbatim, falling back to "Amazon" when absent.
