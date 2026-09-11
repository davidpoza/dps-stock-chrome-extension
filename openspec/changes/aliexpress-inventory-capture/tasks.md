## 1. Project scaffolding

- [x] 1.1 Create the MV3 `manifest.json`: name, version, `manifest_version: 3`, `permissions: ["storage"]`, static `host_permissions` for `https://www.aliexpress.com/*` and `https://*.aliexpress-media.com/*`, `optional_host_permissions` for the configurable backend origin, background service worker, options page, and a content script matching `https://www.aliexpress.com/p/order/*`.
- [x] 1.2 Create the source layout: `background/service-worker.js`, `content/content.js`, `content/dialog.js`, `content/toast.js`, `stores/aliexpress.js` (adapter), `options/options.html` + `options/options.js`, `shared/settings.js`, `shared/api.js`, `shared/price.js`. Wire ES modules where the context allows.
- [x] 1.3 Add a README with load-unpacked instructions and the ADMIN-API-key requirement.

## 2. Settings & backend client (background + shared)

- [x] 2.1 Implement `shared/settings.js`: get/set `{ backendUrl, apiKey, toolTemplateId, partTemplateId }` in `chrome.storage.local`; helper to check "is configured".
- [x] 2.2 Implement `shared/api.js`: build requests to `backendUrl` with the `X-API-Key: <key>.<secret>` header; helpers for `GET /item-templates`, `POST /items`, `POST /items/{id}/upload` (multipart), `POST /suppliers`, `POST /items/{id}/buying-links`; normalize 401/403 into a typed auth error.
- [x] 2.3 Implement the service-worker message API (`chrome.runtime.onMessage`): `testConnection`, `getTemplates`, `createTool`, `createPart` — the only place the API key is read.
- [x] 2.4 Implement `testConnection`: perform a representative authenticated call and return `{ ok, reason }` distinguishing unreachable vs 401/403.

## 3. Options page

- [x] 3.1 Build `options.html` form: backend URL, API key, Test-connection button, Tool-template select, Part-template select, Save button, status area.
- [x] 3.2 On save, validate required fields, persist settings, and request the backend host permission via `chrome.permissions.request` for the entered origin.
- [x] 3.3 Wire "Test connection" to the `testConnection` message and show success/failure with the distinguishing reason.
- [x] 3.4 Load templates via `getTemplates`; populate the Tool select with only tool-capable templates; persist selected template ids.

## 4. AliExpress store adapter

- [x] 4.1 Define the `StoreAdapter` shape and implement `stores/aliexpress.js`: `matches(url)`, `findCards()` (`.order-item`), `getButtonMount(card)` (`.order-item-btns`).
- [x] 4.2 Implement `extract(card)` mapping: description (`.order-item-content-info-name span[title]`), imageUrl (parsed from `.order-item-content-img` `background-image`, strip `_220x220` when present), productLink (`a[href*="/item/"]`), supplierName (`.order-item-store-name`, default "AliExpress"), reference (product id from link, fallback SKU `.order-item-content-info-sku`).
- [x] 4.3 Implement `shared/price.js`: reconstruct the amount from `.es--char` spans / `textContent`, parse comma-decimal, and separate the currency symbol; unit-test against sample strings (e.g. `8,79 €` → `8.79`, `€`).

## 5. Content script: injection & capture

- [x] 5.1 Detect the orders page, find cards, and inject "Add Tool to Inventory" / "Add Part to Inventory" buttons into each card's mount, guarded by a `data-dps-injected` marker (no duplicates).
- [x] 5.2 Use a `MutationObserver` on the orders container to inject buttons on dynamically loaded/paginated cards.
- [x] 5.3 On button click, run `extract(card)`; if settings are not configured, prompt to open Options and stop.

## 6. Confirmation dialog & feedback (Shadow DOM)

- [x] 6.1 Implement `content/dialog.js`: a Shadow-DOM dialog pre-filled from the extracted data; Tool variant (description, photo) and Part variant (adds supplier name, link, price, reference); Confirm/Cancel.
- [x] 6.2 On Confirm, send `createTool`/`createPart` to the service worker with the (edited) fields; Cancel closes without any backend call.
- [x] 6.3 Implement `content/toast.js` for in-page success / partial-success / failure messages.

## 7. Item creation flows (background)

- [x] 7.1 `createTool`: require `toolTemplateId` (else return a config error), `POST /items { description, templateId }`, then upload the photo; return success/partial.
- [x] 7.2 `createPart`: `POST /items { description }`, upload photo, `POST /suppliers { description: supplierName, link, itemId }`, `POST /items/{id}/buying-links { link, price, supplierReference, description }`; aggregate per-step results.
- [x] 7.3 Photo upload helper: `fetch(imageUrl)` → `Blob` → multipart `POST /items/{id}/upload` with `type=PHOTO`; treat failure as non-fatal (partial success).
- [x] 7.4 Map results to user-facing outcomes: full success, partial success (name the failed sub-step), and failure (including auth errors).

## 8. Manual verification

- [ ] 8.1 Load unpacked, configure an admin-scoped API key + backend URL, run Test connection, and select a Tool template.
- [ ] 8.2 On `https://www.aliexpress.com/p/order/index.html`, verify buttons appear on all cards (including after pagination) with no duplicates.
- [ ] 8.3 Add a Tool and confirm the item + photo are created in the backend; verify the item is tool-capable.
- [ ] 8.4 Add a Part and confirm the item, photo, supplier, and buying link (price + reference) are created; verify partial-success messaging when the photo URL is unreachable.
