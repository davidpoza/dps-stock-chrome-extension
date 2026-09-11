## Context

The content script (`content/main.js`) injects the two capture buttons per order item and keeps them in sync as the store's SPA renders. It does this three ways: an initial `injectAll()`, a brief `setInterval` retry to cover first paint, and a `MutationObserver` on `document.body` (`subtree: true`) that reacts to added nodes. Selection of order items is delegated to the active `StoreAdapter.findCards(root)`, which is implemented with `root.querySelectorAll(...)`.

The observer currently reacts to each added node with only:

```js
if (node.querySelectorAll) injectAll(node); // findCards(node) => node.querySelectorAll(...)
```

`querySelectorAll` matches **descendants only**, never the root node itself. Investigation of the saved AliExpress orders page confirms the failure mode:

- All `.order-item` cards are **direct children** of the list container `.comet-checkbox-group`.
- "View orders" (`div.order-more`) appends more `.order-item` elements directly into that container.
- For such an appended node, `node.querySelectorAll('.order-item')` returns `0` while `node.matches('.order-item')` is `true` — so the current observer skips it and the new orders get no buttons.

An earlier refactor (during the Amazon work) removed the store-specific `if (node.matches('.order-item')) injectCard(node)` fast-path in favour of the generic descendant scan, which is what regressed the direct-sibling case. This change restores that behaviour generically.

## Goals / Non-Goals

**Goals:**
- Ensure order items appended after load — direct siblings or nested in a subtree — get buttons, across all supported stores.
- Keep the fix store-agnostic (no store selectors in `content/main.js`).
- Preserve idempotency (no duplicate buttons) and the existing initial-render behaviour.

**Non-Goals:**
- Changing how order items are extracted, the dialog, or backend flows.
- Handling infinite scroll differently from "View orders" (the same observer path covers both).
- Any manifest, permission, or backend change.

## Decisions

### 1. Add an `isCard(node)` predicate to the `StoreAdapter` interface
Give each adapter a cheap `isCard(node)` that returns true when the node *is itself* an order item, and have the observer consult it:

```js
for (const node of m.addedNodes) {
  if (node.nodeType !== 1) continue;
  if (activeAdapter.isCard && activeAdapter.isCard(node)) injectCard(node);
  if (node.querySelectorAll) injectAll(node); // descendants
}
```

- AliExpress: `isCard(node) => node.matches?.('.order-item')`.
- Amazon: `isCard(node) => node.matches?.('.order-card .a-fixed-left-grid.item-box') || (node.matches?.('.a-fixed-left-grid') && !!node.querySelector('[data-component="itemTitle"]'))` — mirroring the two layouts handled in `findCards`.

`injectCard` already guards on `getButtonMount(card)` and the `data-dps-injected` marker, so calling it for a matched node is safe and idempotent, and a node that is both a card and contains nested cards is handled once by each branch without duplication.

*Alternatives considered:*
- **Scan the added node's parent** (`injectAll(node.parentElement)`): catches direct siblings but re-scans the whole container on every append — O(n²) over a "load more" batch — and reaches beyond the mutation. Rejected as wasteful and broad.
- **A shared card selector string on the adapter** consumed by both `findCards` and `isCard`: cleaner in theory, but Amazon's order-details card is identified by structure (a `.a-fixed-left-grid` that contains an `itemTitle`), not a single selector, so a predicate is the right abstraction. `isCard` keeps that logic in the adapter alongside `findCards`.
- **Re-hardcode `.order-item` in the observer**: fast but reintroduces store coupling in the store-agnostic content script and would silently skip Amazon. Rejected.

### 2. Keep the existing descendant scan and initial retries
The direct-node branch is additive; the descendant scan still covers re-rendered subtrees (e.g. the whole list container being swapped), and the initial `injectAll()` + `setInterval` retry still cover first paint. No behaviour is removed.

## Risks / Trade-offs

- **`isCard` selectors drift from `findCards`** → a card recognised by one but not the other. *Mitigation:* both live in the same adapter module and are derived from the same selectors; kept adjacent so they are updated together. Even if `isCard` misses, a subsequently added wrapper or the initial scan may still catch the item, so the failure mode degrades rather than crashes.
- **Observer fires very frequently on chatty SPAs** → extra `isCard` checks. *Mitigation:* `isCard` is a single `matches`/`querySelector` call and `injectCard` short-circuits on the marker, so the added cost is negligible.
- **False positive `isCard`** injecting buttons on a non-item node → *Mitigation:* selectors are specific (`.order-item`, `.item-box`, `itemTitle`); `getButtonMount` still runs and the confirm dialog is user-gated, so a stray button would be harmless and visible in testing.

## Migration Plan

Reload the unpacked extension (`chrome://extensions` → Reload). No data or backend impact. Rollback = revert the change and reload.

## Open Questions

- None. The fix is a localised, additive correction to the observer plus a small adapter predicate.
