## ADDED Requirements

### Requirement: Keep capture buttons in sync with dynamically loaded orders
The extension SHALL add the "Add Tool to Inventory" and "Add Part to Inventory" buttons to order items that appear on a supported order page after the initial render, regardless of how the store inserts them into the DOM. This SHALL cover order items appended as a **direct sibling** into an existing list container (for example, AliExpress adding more orders when the user activates "View orders") as well as order items contained within a re-rendered subtree. The extension SHALL NOT add duplicate buttons to an item that already has them.

#### Scenario: Buttons appear on orders loaded via "View orders"
- **WHEN** the user activates AliExpress "View orders" and the page appends additional order items directly into the order list container
- **THEN** each newly appended order item receives the "Add Tool to Inventory" and "Add Part to Inventory" buttons without a page reload

#### Scenario: Buttons appear on order items added directly as siblings
- **WHEN** an order item is inserted into the page as the added node itself (a direct sibling of existing items), not nested inside an added wrapper element
- **THEN** the extension recognises the added node as an order item and injects its buttons

#### Scenario: Buttons appear on order items inside a re-rendered subtree
- **WHEN** a container holding one or more order items is added to the page
- **THEN** the extension injects buttons into every order item found within that added subtree

#### Scenario: No duplicate buttons on re-processed items
- **WHEN** the observer processes a mutation over an order item that already has its buttons
- **THEN** the item still shows exactly one pair of buttons

#### Scenario: Non-order nodes are ignored
- **WHEN** a DOM node that is not an order item is added to the page
- **THEN** the extension injects no buttons for that node
