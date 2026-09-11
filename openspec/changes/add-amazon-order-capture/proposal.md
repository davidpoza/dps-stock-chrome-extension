## Why

The extension currently captures inventory only from AliExpress, but a large share of the user's tools and parts are bought on Amazon. The architecture was deliberately built around a pluggable `StoreAdapter` so a second store could be added without touching the content script or backend flows — this change delivers that second store.

## What Changes

- Add an **Amazon store adapter** (`stores/amazon.js`) implementing the existing `StoreAdapter` interface (`matches`, `findCards`, `getButtonMount`, `extract`).
- Support the two Amazon pages the user works from on `amazon.es`:
  - **Order history / your-orders list** (`.../gp/css/order-history`, `.../your-orders/orders`) — per-item cards inside each `.order-card`.
  - **Order details** (`.../your-orders/order-details`, `.../gp/css/order-details`) — per-item rows inside `[data-component="purchasedItems"]`.
- Inject the existing **"Add Tool to Inventory"** / **"Add Part to Inventory"** buttons onto each Amazon order item, reusing the current dialog, toast, and service-worker create flows unchanged.
- Extract per item: description (product title), image (upscaled Amazon CDN URL), product link (`/dp/<ASIN>`), reference (the ASIN), and — where the page exposes them — the unit price and the "Sold by" seller name.
- Register the extension on Amazon pages: add static `host_permissions`/content-script matches for `amazon.es` and the Amazon image CDNs so the service worker can fetch product photos, and expose `stores/amazon.js` as a web-accessible resource.
- Make the content script and the Part supplier fallback **store-agnostic** (drive re-injection from the active adapter instead of the hard-coded AliExpress class; default the supplier name from the captured store rather than always "AliExpress").

## Capabilities

### New Capabilities
- `amazon-order-capture`: Detecting Amazon order items on the order-history list and order-details pages, injecting the Add Tool / Add Part buttons, and extracting item data (description, photo, product link, ASIN reference, and — when present — unit price and seller name).

### Modified Capabilities
<!-- None. `extension-configuration` and `inventory-item-creation` are unchanged at the requirement level: the manifest host-permission additions, adapter registration, and the store-agnostic supplier-name fallback are implementation details, not new/changed spec behavior. -->

## Impact

- **New file**: `stores/amazon.js` (the adapter with Amazon selectors and Amazon-specific image upscaling).
- **Modified files**:
  - `manifest.json` — add `amazon.es` + Amazon image-CDN host permissions, an Amazon content-script match, and `stores/amazon.js` under `web_accessible_resources`.
  - `content/main.js` — register `amazonAdapter`; generalize the `MutationObserver` re-injection to use the active adapter's `findCards` instead of the AliExpress-only `.order-item` selector.
  - `background/service-worker.js` — derive the default Part supplier name from the captured store instead of the literal `'AliExpress'`.
  - `README.md` — document Amazon support and the supported order pages.
- **No backend changes**; reuses `POST /items`, `POST /items/{id}/upload`, `POST /suppliers`, `POST /items/{id}/buying-links`, `GET /item-templates`.
- **Scope**: `amazon.es` only in this change (the user's marketplace); other TLDs can be added later by extending the adapter's `matches` regex and the manifest patterns.
