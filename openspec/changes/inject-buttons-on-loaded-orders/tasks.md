## 1. Adapter predicate

- [x] 1.1 In `stores/aliexpress.js`, add `isCard(node)` to `aliexpressAdapter` returning true when `node.matches?.('.order-item')`.
- [x] 1.2 In `stores/amazon.js`, add `isCard(node)` to `amazonAdapter` returning true for an order-history list card (`node.matches?.('.order-card .a-fixed-left-grid.item-box')`) or an order-details card (`node.matches?.('.a-fixed-left-grid')` and `node.querySelector('[data-component="itemTitle"]')`).

## 2. Content-script observer

- [x] 2.1 In `content/main.js` `observe()`, when an added element node satisfies `activeAdapter.isCard(node)`, call `injectCard(node)` directly, in addition to the existing `injectAll(node)` descendant scan; keep the `data-dps-injected` idempotency guard.
- [x] 2.2 Guard the call so adapters without `isCard` still work (`activeAdapter.isCard && activeAdapter.isCard(node)`).

## 3. Verification

- [x] 3.1 `node --check content/main.js stores/aliexpress.js stores/amazon.js` passes and `npm test` stays green.
- [x] 3.2 Against the saved AliExpress page, simulate appending an existing `.order-item` clone directly into `.comet-checkbox-group` and confirm the observer path injects exactly one pair of buttons on it (no duplicates, none on non-item nodes).
- [ ] 3.3 Manual: on the live AliExpress orders page, click "View orders" and confirm the newly loaded orders show both buttons with no duplicates; confirm Amazon list/details still inject correctly.
