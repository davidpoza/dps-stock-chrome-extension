## ADDED Requirements

### Requirement: Inject action buttons on AliExpress order cards
On the AliExpress orders page (`https://www.aliexpress.com/p/order/index.html`), the extension SHALL add an "Add Tool to Inventory" button and an "Add Part to Inventory" button to each order card. The extension SHALL handle the page's dynamic, client-rendered nature so that buttons also appear on cards loaded after the initial render (pagination, lazy load, navigation) and SHALL NOT inject duplicate buttons on a card that already has them.

#### Scenario: Buttons appear on existing cards
- **WHEN** the orders page finishes rendering its order cards
- **THEN** each order card shows an "Add Tool to Inventory" and an "Add Part to Inventory" button

#### Scenario: Buttons appear on dynamically loaded cards
- **WHEN** additional order cards are rendered after the initial load (e.g., pagination or lazy loading)
- **THEN** the new cards also receive the two buttons without a page reload

#### Scenario: No duplicate buttons
- **WHEN** the page re-renders or the injection routine runs again over a card that already has the buttons
- **THEN** the card still shows exactly one pair of buttons

#### Scenario: Only on the orders page
- **WHEN** the user is on an AliExpress page that is not the orders list
- **THEN** no buttons are injected

### Requirement: Extract item data from an order card
When an action button is activated, the extension SHALL extract, from that card, the fields needed to create an inventory item: product description, image URL, product link, store/supplier name, unit price (as a decimal amount and currency), and a reference derived from the product id (falling back to the SKU/variant text). The price MUST be parsed correctly even though AliExpress splits the price string across multiple per-character elements.

#### Scenario: Extract from a well-formed card
- **WHEN** a card contains a product name, an image, a product link, a store name, and a price
- **THEN** the extension produces a data object with the description, image URL, product link, supplier name, parsed decimal price with currency, and reference

#### Scenario: Parse split price digits
- **WHEN** the card's price is rendered as individual character elements (e.g., separate spans for `8`, `,`, `7`, `9`, `€`)
- **THEN** the extension reconstructs the amount `8.79` and the currency `€`

#### Scenario: Tolerate missing optional fields
- **WHEN** a card is missing an optional field (e.g., no resolvable image or price)
- **THEN** the extension still produces a data object with the fields it could read and marks the missing ones as empty rather than failing

### Requirement: Confirm captured data before saving
Activating a button SHALL open a pre-filled confirmation dialog showing the captured fields, allowing the user to edit them and choose to confirm or cancel. For a Part, the supplier name, link, price, and reference fields SHALL be shown; for a Tool they SHALL NOT. The dialog SHALL be visually isolated from the host page so AliExpress styles do not break it.

#### Scenario: Open pre-filled dialog for a Part
- **WHEN** the user clicks "Add Part to Inventory" on a card
- **THEN** a dialog opens pre-filled with the description, photo, supplier name, link, price, and reference

#### Scenario: Open pre-filled dialog for a Tool
- **WHEN** the user clicks "Add Tool to Inventory" on a card
- **THEN** a dialog opens pre-filled with the description and photo, and does not show supplier/price/reference fields

#### Scenario: Cancel makes no changes
- **WHEN** the user cancels the dialog
- **THEN** nothing is sent to the backend and the dialog closes

### Requirement: Require configuration before capture
If the backend URL or API key is not configured, activating a button SHALL not attempt a save; instead it SHALL prompt the user to open the options page.

#### Scenario: Missing configuration
- **WHEN** the user activates a button while the extension has no backend URL or API key configured
- **THEN** the extension shows a message directing the user to configure settings and does not call the backend
