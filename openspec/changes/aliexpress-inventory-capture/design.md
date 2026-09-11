## Context

This repository is empty apart from tooling; the extension is greenfield. It integrates with the existing `dps-stock-backend` (Spring Boot, unified `/items` API), consumed here as a black-box REST service. Findings from the backend and a captured AliExpress orders page (`/home/coder/Downloads/aliexpress.html`) drive the decisions below.

Backend facts that constrain the design:
- **Auth**: API-key auth via header `X-API-Key: <key>.<secret>` (parsed by `ApiKeyAuthenticationFilter`). Authorities come from the key record.
- **Authorization**: `POST /items` and `POST /items/{id}/buying-links` require role `ADMIN`; `POST /items/{id}/upload` requires `USER`. Therefore the configured key must be **admin-scoped**.
- **Item model**: `POST /items` takes `ItemCreateDTO` (`description` required; `templateId` optional). "Tool" = an item whose template enables the `TOOL` capability. "Part" = a plain material item.
- **Photo**: `POST /items/{itemId}/upload` is multipart (`file`, `type`, optional `description`). There is a URL-based `POST /upload-url`, but it is not item-scoped, so photos are attached by uploading bytes to the item-scoped multipart endpoint.
- **Supplier / buying link**: `POST /suppliers` (`description`, `link`, `itemId`); `POST /items/{itemId}/buying-links` (`link`, `price`, `supplierReference`, `description`, `minUnits`).
- **CORS**: backend restricts origins, but the extension avoids page-origin CORS entirely by calling from the service worker with host permissions.

AliExpress orders page facts (readable class names, client-rendered SPA):
- Order card: `.order-item`. Product link: `a[href*="/item/"]` (e.g. `/item/1005006624805916.html`). Image: `.order-item-content-img` with the URL inside `background-image: url("…_220x220.png")`. Name: `.order-item-content-info-name span[title]`. Store: `.order-item-store-name`. Unit price: `.order-item-content-info-number` (digits split across `.es--char` spans; `textContent` concatenates them). SKU/variant: `.order-item-content-info-sku`. Button area: `.order-item-btns` / `.order-item-btns-wrap`.

## Goals / Non-Goals

**Goals:**
- Ship a Manifest V3 Chrome extension that adds Tool/Part capture buttons on the AliExpress orders page.
- Capture description, photo, product link, store name, price, and reference from an order card.
- Create Tool and Part items in DPS Stock (item + photo, plus supplier + buying link for Parts) via one confirmed action.
- Keep the API key out of the page context and route all backend traffic through the service worker.
- Structure the code so additional stores (Amazon) plug in later.

**Non-Goals:**
- Amazon or any store other than AliExpress in this change.
- Editing/updating or de-duplicating items already in inventory (always creates new).
- Backend changes, new endpoints, or role/permission changes.
- A build toolchain/framework; ship plain MV3 with ES modules, loadable unpacked.
- Bulk / multi-card capture in a single action.

## Decisions

### 1. Manifest V3, vanilla ES modules, no bundler
Plain `manifest.json` + ES-module JS keeps a personal tool trivially loadable as "unpacked" and dependency-free. *Alternatives:* React/TS + Vite (better DX, but build overhead and heavier for scope); MV2 (deprecated). *Rationale:* smallest thing that works; a bundler can be added later without changing architecture.

### 2. Three execution contexts with a clear split
- **Content script** (matches `https://www.aliexpress.com/p/order/*`): observes the DOM, injects buttons, scrapes a card, renders the confirmation dialog, shows in-page toasts. Holds **no** credentials.
- **Background service worker**: owns all backend I/O and the API key; exposes a message API (`testConnection`, `getTemplates`, `createTool`, `createPart`) via `chrome.runtime.onMessage`.
- **Options page**: edits settings, tests the connection, lists templates.

*Rationale:* satisfies the "credentials never in the page" requirement and sidesteps page-origin CORS — the service worker fetches with host permissions, which bypass CORS for permitted hosts. *Alternative:* fetch directly from the content script (would leak the key into the page context and hit CORS). Rejected.

### 3. Settings storage
Use `chrome.storage.local` for `{ backendUrl, apiKey, toolTemplateId, partTemplateId }`. `apiKey` stored as the full `key.secret` string. *Alternative:* `chrome.storage.sync` (roams across devices but syncs the secret to Google and has tighter quotas) — rejected for a secret. Document that `storage.local` is not encrypted at rest; acceptable for a self-hosted personal tool.

### 4. Backend host permission is dynamic
The backend URL is user-configured, so the manifest cannot hardcode it. Use `optional_host_permissions` and request the specific origin from the options page when the user saves the URL (`chrome.permissions.request`). Manifest static host permissions cover only AliExpress (`https://www.aliexpress.com/*`) and the image CDN (`https://*.aliexpress-media.com/*`). *Alternative:* `<all_urls>` (simpler, over-broad) — rejected.

### 5. Robust, resilient DOM capture
Inject via a `MutationObserver` on the orders container plus an idempotency guard (a `data-dps-injected` marker) so pagination/lazy-load get buttons and re-renders don't duplicate them. Scrape lazily **on click** (not at injection) so data reflects the current DOM. Selectors live in one `aliexpress.js` adapter module (a small `StoreAdapter` interface: `matches(url)`, `findCards()`, `getButtonMount(card)`, `extract(card)`), isolating fragile selectors and making Amazon a second adapter later.

Field mapping:
- description ← `.order-item-content-info-name span[title]` (title attr; fall back to text)
- imageUrl ← parse `url("…")` from `.order-item-content-img` `style.backgroundImage` (optionally strip the `_220x220` suffix for a larger image)
- productLink ← `a[href*="/item/"]` href
- supplierName ← `.order-item-store-name` text (default if empty: "AliExpress")
- price/currency ← `.order-item-content-info-number` `textContent`, parsed (strip currency symbol, treat `,` as decimal separator)
- reference ← product id from the `/item/{id}.html` link; fall back to `.order-item-content-info-sku`

### 6. Confirmation dialog in a Shadow DOM
Render the pre-filled form inside a `shadowRoot` attached to an injected host element so AliExpress CSS cannot break it and the extension's CSS cannot leak out. Tool form shows description + photo; Part form adds supplier name, link, price, reference. *Alternative:* the extension popup — rejected because the popup cannot easily reference the specific clicked card.

### 7. Create sequence (in the service worker)
- **Tool:** `POST /items { description, templateId: toolTemplateId }` → get `id` → upload photo.
- **Part:** `POST /items { description }` → get `id` → upload photo → `POST /suppliers { description: supplierName, link, itemId }` → `POST /items/{id}/buying-links { link, price, supplierReference: reference, description: supplierName }`.
- **Photo:** service worker `fetch(imageUrl)` → `Blob` → `FormData` (`file`, `type=PHOTO`) → `POST /items/{id}/upload`.
- Item creation is the critical step; photo/supplier/buying-link failures downgrade the result to **partial success** rather than failing the whole operation, and the message says which sub-step failed.

## Risks / Trade-offs

- **AliExpress markup changes** → break scraping. *Mitigation:* all selectors in one adapter; graceful degradation (empty fields, not crashes) plus the confirm-before-save dialog lets the user fix bad captures.
- **API key requires ADMIN; a USER-only key silently fails on `POST /items`** → *Mitigation:* "Test connection" attempts a representative call and reports 401/403 clearly; document the ADMIN requirement in the options UI and README.
- **API key stored unencrypted in `storage.local`** → *Mitigation:* keep it out of the page context, self-hosted/personal scope, documented; a future enhancement could add a passphrase.
- **Split-character price parsing / locale** (`8,79 €`) → *Mitigation:* dedicated parser handling comma decimals and currency symbols; price is user-editable in the dialog before save.
- **Image CDN fetch/CORS from the service worker** → *Mitigation:* declare `https://*.aliexpress-media.com/*` host permission so the worker can fetch bytes; if a fetch fails, report partial success (item kept).
- **`upload-url` alternative not usable** (not item-scoped) → accepted; use the multipart item-scoped upload with bytes fetched in the worker.

## Migration Plan

Greenfield; nothing to migrate. Rollout: load unpacked in Chrome (`chrome://extensions` → Developer mode → Load unpacked), open Options, set backend URL + admin API key, Test connection, pick a Tool template. Rollback = disable/remove the unpacked extension; no backend state is altered beyond items the user explicitly creates.

## Open Questions

- **Reference field**: default to AliExpress product id (stable/unique) with SKU as fallback — confirm this matches how the user wants `supplierReference` populated.
- **Stock/quantity on Parts**: capture the order quantity (`x2`) into `stock`, or leave stock unset for manual entry? Default: leave unset in this change.
- **Image size**: keep the `_220x220` thumbnail or strip the suffix for a full-resolution image? Default: strip when the pattern is present, else use as-is.
- **Larger image via product page**: not fetched in this change (would require loading the product page); thumbnail is sufficient for MVP.
