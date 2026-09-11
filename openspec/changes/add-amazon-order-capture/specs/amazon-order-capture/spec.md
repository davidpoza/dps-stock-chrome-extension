## ADDED Requirements

### Requirement: Inject action buttons on Amazon order items
On the supported Amazon `amazon.es` order pages — the order-history / your-orders list and the order-details page — the extension SHALL add an "Add Tool to Inventory" button and an "Add Part to Inventory" button to each purchased-item entry. An "item" is a single ordered product; an order that contains several products SHALL receive one pair of buttons per product. The extension SHALL handle Amazon's dynamic rendering so that buttons also appear on items rendered after the initial paint, and SHALL NOT inject duplicate buttons on an item that already has them.

#### Scenario: Buttons appear on order-history list items
- **WHEN** the Amazon order-history / your-orders list finishes rendering its order cards
- **THEN** each purchased item within each order card shows an "Add Tool to Inventory" and an "Add Part to Inventory" button

#### Scenario: Buttons appear on order-details items
- **WHEN** the Amazon order-details page finishes rendering its purchased items
- **THEN** each purchased item shows an "Add Tool to Inventory" and an "Add Part to Inventory" button

#### Scenario: One pair of buttons per product in a multi-item order
- **WHEN** an order card or order-details page lists several products
- **THEN** every product receives its own pair of buttons

#### Scenario: No duplicate buttons
- **WHEN** the page re-renders or the injection routine runs again over an item that already has the buttons
- **THEN** the item still shows exactly one pair of buttons

#### Scenario: Only on supported order pages
- **WHEN** the user is on an Amazon page that is not a supported order-history or order-details page
- **THEN** no buttons are injected

### Requirement: Extract item data from an Amazon order item
When an action button is activated, the extension SHALL extract, from that item, the fields needed to create an inventory item: product description (title), image URL, product link, a reference derived from the product ASIN, and — when the page exposes them — the unit price (as a decimal amount and currency) and the seller ("Sold by") name. The extension SHALL request a full-resolution Amazon image by removing the CDN size token from the image URL. When the page does not expose a field (for example, the order-history list shows no per-item price or seller), the extension SHALL leave that field empty rather than failing.

#### Scenario: Extract from an order-details item
- **WHEN** an order-details item shows a product title, an image, a product link, a "Sold by" seller, and a unit price
- **THEN** the extension produces a data object with the description, upscaled image URL, product link, seller name as the supplier, parsed decimal price with currency, and the ASIN as the reference

#### Scenario: Extract from an order-history list item
- **WHEN** an order-history list item shows a product title, an image, and a product link but no per-item price or seller
- **THEN** the extension produces a data object with the description, upscaled image URL, product link, and the ASIN as the reference, leaving price empty and defaulting the supplier name to "Amazon"

#### Scenario: Reference is the ASIN
- **WHEN** the item's product link is of the form `.../dp/<ASIN>` or `.../gp/product/<ASIN>`
- **THEN** the extension uses the 10-character ASIN as the reference

#### Scenario: Upscale the product image
- **WHEN** the captured image URL contains an Amazon CDN size token (e.g. `._SS284_` or `._AC_UL165_SR165,165_`)
- **THEN** the extension removes the size token so a larger image is requested

#### Scenario: Tolerate missing optional fields
- **WHEN** an item is missing an optional field (e.g. no resolvable image or price)
- **THEN** the extension still produces a data object with the fields it could read and marks the missing ones as empty rather than failing

### Requirement: Reuse the confirmation and save flow for Amazon items
Activating a button on an Amazon item SHALL open the same pre-filled confirmation dialog used for other stores, allowing the user to review and edit the captured fields (including filling in a price or supplier that the page did not expose) before confirming or cancelling. On confirm, the extension SHALL create the Tool or Part in DPS Stock through the existing service-worker create flow, and SHALL report success, partial success, or failure in the page.

#### Scenario: Confirm an Amazon Part
- **WHEN** the user clicks "Add Part to Inventory" on an Amazon item and confirms the dialog
- **THEN** the extension creates the Part with the confirmed description, photo, supplier name, link, price, and reference, and reports the outcome in the page

#### Scenario: Fill a missing price before saving
- **WHEN** the captured item had no price (e.g. from the order-history list) and the user enters a price in the dialog
- **THEN** the extension saves the Part using the user-entered price

#### Scenario: Cancel makes no changes
- **WHEN** the user cancels the dialog
- **THEN** nothing is sent to the backend and the dialog closes
