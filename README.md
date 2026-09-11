# DPS Stock — AliExpress Inventory Capture (Chrome extension)

A Manifest V3 Chrome extension that adds **"Add Tool to Inventory"** and
**"Add Part to Inventory"** buttons to each order card on the AliExpress orders
page (`https://www.aliexpress.com/p/order/index.html`). It scrapes the product
description, photo, link, store name, price, and reference, lets you review them
in a confirmation dialog, and creates the item in your
[DPS Stock backend](../dps-stock-backend) via its REST API.

AliExpress is the only supported store for now; the code is structured around a
`StoreAdapter` so other stores (e.g. Amazon) can be added later.

## Requirements

- Google Chrome (or any Chromium browser with MV3 support).
- A running DPS Stock backend and an **ADMIN-scoped API key**.
  Creating items (`POST /items`) and buying links (`POST /items/{id}/buying-links`)
  require the `ADMIN` role, so a `USER`-only key will fail at save time. The key
  is used as the `X-API-Key: <key>.<secret>` header.

## Install (load unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder (the one containing
   `manifest.json`).
4. Click the extension's **Options** (or the toolbar icon) and configure:
   - **Backend base URL** (e.g. `http://localhost:8080`). Saving prompts Chrome
     to grant host access to that origin.
   - **API key** in `key.secret` form.
   - **Default Tool template** — required to add Tools; only TOOL-capable
     templates are listed. Optionally a default Part template.
5. Click **Test connection** to verify the URL and key.

## Usage

1. Go to `https://www.aliexpress.com/p/order/index.html`.
2. Each order shows two buttons. Click **Add Tool** or **Add Part**.
3. Review/edit the pre-filled fields and click **Save to DPS Stock**.
   - **Tool** → creates a tool-capable item (using the default Tool template)
     and attaches the photo.
   - **Part** → creates a material item, attaches the photo, records the
     supplier (name + link), and adds a buying link (link, price, reference).
4. An in-page toast reports success, partial success (e.g. the photo failed but
   the item was created), or an error.

## How it works

- **Content script** (`content/`) injects buttons, watches the SPA with a
  `MutationObserver`, scrapes the clicked card, and shows a Shadow-DOM dialog.
  It never receives the API key.
- **Background service worker** (`background/service-worker.js`) is the only
  context that reads the key and calls the backend; it also downloads the
  product image and uploads it to the item.
- **Options page** (`options/`) stores settings in `chrome.storage.local`,
  requests host permission for the backend, tests the connection, and lists
  templates.
- **Store adapter** (`stores/aliexpress.js`) holds all AliExpress selectors.
- **Shared** (`shared/`) — settings, REST client, and price parsing.

## Project layout

```
manifest.json
background/service-worker.js   # backend I/O + message API (holds the API key)
content/content.js             # classic loader -> dynamically imports main.js
content/main.js                # injection, observer, capture orchestration
content/dialog.js              # Shadow-DOM confirmation dialog
content/toast.js               # Shadow-DOM notifications
stores/aliexpress.js           # AliExpress StoreAdapter (selectors + extract)
options/options.html/js        # settings UI
shared/settings.js             # chrome.storage.local wrapper
shared/api.js                  # REST client + typed ApiError
shared/price.js                # locale-aware price parser
```

## Tests

Price parsing has unit tests (Node's built-in runner, no dependencies):

```
npm test
```

## Releases

A GitHub Actions workflow (`.github/workflows/release.yml`) packages the
extension and publishes it to GitHub Releases. It runs the tests, verifies that
`manifest.json`'s `version` matches the tag, zips the runtime files (excluding
tests), and attaches `dps-stock-extension-<tag>.zip` to the release.

To cut a release, bump `version` in `manifest.json`, then tag and push:

```
git tag v0.1.0
git push origin v0.1.0
```

You can also trigger it manually from the **Actions** tab (workflow_dispatch),
providing the tag. The tag must match the manifest version (e.g. tag `v0.1.0`
→ manifest `0.1.0`), or the workflow fails with a clear message.

## Notes & limitations

- Settings live in `chrome.storage.local` and are not encrypted at rest; keep
  this for personal/self-hosted use.
- Scraping depends on AliExpress markup; if a field can't be read it is left
  empty rather than failing, and you can fix it in the dialog before saving.
- The order quantity is not written to stock in this version.
```
