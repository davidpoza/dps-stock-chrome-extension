## Why

On AliExpress the orders page loads more orders when the user clicks **"View orders"**; those newly loaded order cards do **not** get the "Add Tool / Add Part" buttons, so they cannot be captured without a full page reload. AliExpress appends each new `.order-item` as a **direct child** of the list container (`.comet-checkbox-group`), and the content script's `MutationObserver` only scans an added node's *descendants* (`findCards(node)` → `node.querySelectorAll(...)`), which never matches the added node itself. The result is that "load more" batches are silently skipped.

## What Changes

- Fix the content-script injection so buttons appear on order items that are added to the page **after** the initial render, including AliExpress "View orders" pagination and any store that appends an order item as a direct sibling rather than inside a wrapper.
- Add a small `isCard(node)` predicate to the `StoreAdapter` interface so the observer can recognise when an added node is *itself* an order item (not only when order items are nested inside an added subtree). Implement it for both the AliExpress and Amazon adapters.
- Update the `MutationObserver` in `content/main.js` to inject directly when `activeAdapter.isCard(addedNode)` is true, in addition to the existing descendant scan, keeping the `data-dps-injected` idempotency guard (no duplicate buttons).

## Capabilities

### New Capabilities
- `dynamic-order-injection`: The store-agnostic content-script behaviour that keeps capture buttons in sync with order items as they are added to the page — covering items appended as direct siblings (e.g. AliExpress "View orders") as well as items nested in a re-rendered subtree — without duplicating buttons.

### Modified Capabilities
<!-- None at the requirement level. The existing `aliexpress-order-capture` and `amazon-order-capture` specs already assert that buttons appear on dynamically loaded cards; this change adds the missing store-agnostic mechanism that makes that hold, plus the `isCard` adapter hook (an implementation detail of the adapters). -->

## Impact

- **Modified files**:
  - `content/main.js` — observer injects the added node directly when the active adapter reports it is a card.
  - `stores/aliexpress.js` — add `isCard(node)` (matches `.order-item`).
  - `stores/amazon.js` — add `isCard(node)` (matches an order-history `.a-fixed-left-grid.item-box` or an order-details `.a-fixed-left-grid` containing `[data-component="itemTitle"]`).
- **No backend, manifest, or permission changes.**
- **Regression fixed**: this restores (generically) the direct-node injection that the earlier store-agnostic observer refactor removed.
