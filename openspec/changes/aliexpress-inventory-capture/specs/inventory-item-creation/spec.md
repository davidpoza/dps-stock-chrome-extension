## ADDED Requirements

### Requirement: Authenticated backend requests
All backend requests SHALL be made from the extension's background service worker using the configured API key in the `X-API-Key: <key>.<secret>` header. Requests SHALL target the configured backend base URL.

#### Scenario: Attach API key header
- **WHEN** the background service worker sends any request to the DPS Stock backend
- **THEN** the request includes the `X-API-Key` header built from the stored key

#### Scenario: Surface authorization failure
- **WHEN** the backend responds `401` or `403` to a create request
- **THEN** the extension reports an authorization error to the user (e.g., the API key is invalid or lacks the required role) and does not report success

### Requirement: Create a Tool item
On confirming "Add Tool to Inventory", the extension SHALL create an item via `POST /items` using the confirmed description and the configured default Tool template (so the item is tool-capable), then attach the captured photo to the created item.

#### Scenario: Tool created with template and photo
- **WHEN** the user confirms a Tool with a valid description and a resolvable photo
- **THEN** the extension creates the item with the default Tool template and uploads the photo to that item, then reports success

#### Scenario: Missing Tool template configured
- **WHEN** the user confirms a Tool but no default Tool template is configured
- **THEN** the extension does not create the item and directs the user to configure a Tool template

### Requirement: Create a Part item with supplier and buying link
On confirming "Add Part to Inventory", the extension SHALL create a material item via `POST /items` using the confirmed description, attach the captured photo, register the supplier via `POST /suppliers` (supplier name as description, product link as link, associated to the created item), and add a buying link via `POST /items/{itemId}/buying-links` (product link, price, and reference as supplier reference).

#### Scenario: Part created with all associations
- **WHEN** the user confirms a Part with description, photo, supplier name, link, price, and reference
- **THEN** the extension creates the item, uploads the photo, creates the supplier linked to the item, and adds the buying link with the price and reference, then reports success

#### Scenario: Photo attach is non-fatal
- **WHEN** the item is created successfully but the photo upload fails
- **THEN** the extension keeps the created item, reports partial success identifying that the photo failed, and does not leave the operation reported as fully successful

### Requirement: Attach the product photo
The extension SHALL attach the captured product image to the created item by fetching the image bytes in the background service worker and uploading them to `POST /items/{itemId}/upload` with `type=PHOTO`.

#### Scenario: Photo uploaded from captured URL
- **WHEN** a valid image URL was captured for the item
- **THEN** the background service worker downloads the image and uploads it as a photo associated with the created item

### Requirement: Report the outcome in-page
After a save attempt, the extension SHALL show the result in the page (success, partial success, or failure) with enough detail for the user to understand what happened.

#### Scenario: Success feedback
- **WHEN** an item and its associations are created successfully
- **THEN** the extension shows an in-page success message referencing the created item

#### Scenario: Failure feedback
- **WHEN** a create request fails
- **THEN** the extension shows an in-page error message describing the failure and does not indicate success
