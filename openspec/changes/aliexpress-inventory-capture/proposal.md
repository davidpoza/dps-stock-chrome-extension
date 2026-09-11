## Why

Cataloguing purchases into DPS Stock today means retyping each item's description, downloading its photo, and re-entering supplier data by hand. Most of that information already sits on the store's order page. A browser extension that captures it in one click removes the manual copy/paste and keeps the inventory in sync with what was actually bought. We start with AliExpress because its order list is where most low-cost parts and tools originate.

## What Changes

- Introduce a new Chrome (Manifest V3) extension project in this repository (no extension exists yet).
- Add an **options/settings** surface where the user stores the DPS Stock backend base URL and an API key, validates the connection, and picks default item templates. Credentials are kept in extension storage and never exposed to the visited web page.
- Inject two action buttons — **"Add Tool to Inventory"** and **"Add Part to Inventory"** — into each order card on the AliExpress orders page (`https://www.aliexpress.com/p/order/index.html`).
- Scrape the order card for the product description, photo, product link, store/supplier name, unit price, and reference (product id / SKU).
- On click, open a pre-filled confirmation dialog so the user can review/edit the captured fields before saving.
- On confirm, create the item in DPS Stock via its REST API:
  - **Tool** → create a tool-capable item (item + template with the `TOOL` capability) and attach the photo.
  - **Part** → create a material item, attach the photo, and record the supplier (name + link) and a buying link (link, price, reference).
- Surface clear success / error feedback in-page after each save.
- Scope this first release to AliExpress only; the architecture leaves room to add Amazon and other stores later.

## Capabilities

### New Capabilities
- `extension-configuration`: Persisting and validating the backend base URL, API key, and default Tool/Part templates used by the extension.
- `aliexpress-order-capture`: Detecting AliExpress order cards, injecting the Add Tool / Add Part buttons, and extracting item data from the page.
- `inventory-item-creation`: Sending the captured data to the DPS Stock backend to create Tool and Part items with photo, supplier, and buying-link, including result feedback.

### Modified Capabilities
<!-- None. This repository has no existing specs; everything is new. -->

## Impact

- **New project scaffolding**: `manifest.json` (MV3), background service worker, content script, options page, and shared modules.
- **External dependency**: DPS Stock backend REST API (`../dps-stock-backend`). Consumed endpoints: `POST /items`, `POST /items/{id}/upload`, `POST /items/{id}/buying-links`, `POST /suppliers`, `GET /item-templates`. Auth via the `X-API-Key: <key>.<secret>` header.
- **Backend constraint (no code change required, but must be documented)**: `POST /items` and `POST /items/{id}/buying-links` require the `ADMIN` role, so the configured API key must be admin-scoped.
- **Browser permissions**: host access to the configured backend origin and to AliExpress (`https://www.aliexpress.com/*`) plus the image CDN (`https://*.aliexpress-media.com/*`); `storage` permission for settings.
- **No changes to the backend** are in scope for this change.
