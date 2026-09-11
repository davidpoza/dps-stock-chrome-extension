// Store adapter for Amazon (amazon.es) order pages.
//
// Amazon exposes purchased items on two pages with different markup:
//
//   Order-history / your-orders list (`.../gp/css/order-history`,
//   `.../your-orders/orders`) — an older layout using `yohtmlc-*` class hooks.
//   Each `.order-card` holds one or more `.a-fixed-left-grid.item-box` rows.
//   No per-item price or seller is shown here.
//
//   Order-details (`.../your-orders/order-details`, `.../gp/css/order-details`)
//   — a newer layout using `data-component` hooks. Purchased items live under
//   `[data-component="purchasedItems"]`; each item exposes title, image,
//   "Sold by" seller, and unit price.
//
// One "card" is a single ordered product, matching the Tool/Part = one item
// model. See the StoreAdapter shape documented in ../stores/aliexpress.js.

import { parsePrice } from '../shared/price.js';

export const amazonAdapter = {
  id: 'amazon',

  matches(url) {
    return /^https:\/\/www\.amazon\.es\/.*(order-history|your-orders|order-details)/.test(
      String(url || ''),
    );
  },

  findCards(root = document) {
    const cards = new Set();

    // Order-history / your-orders list: item rows inside each order card.
    for (const row of root.querySelectorAll('.order-card .a-fixed-left-grid.item-box')) {
      cards.add(row);
    }

    // Order-details: resolve each purchased item's title to its enclosing row.
    for (const title of root.querySelectorAll(
      '[data-component="purchasedItems"] [data-component="itemTitle"]',
    )) {
      const row = title.closest('.a-fixed-left-grid');
      if (row) cards.add(row);
    }

    return Array.from(cards);
  },

  getButtonMount(card) {
    return (
      card.querySelector('.yohtmlc-item-level-connections') ||
      card.querySelector('[data-component="itemConnections"]') ||
      card
    );
  },

  extract(card) {
    return isDetailsRow(card) ? extractDetails(card) : extractList(card);
  },
};

// Order-details row (`data-component` layout).
function extractDetails(card) {
  const titleLink = card.querySelector('[data-component="itemTitle"] a');
  const description = text(titleLink);
  const productLink = normalizeProductLink(titleLink ? titleLink.href : '');

  const imageUrl = imageFrom(card.querySelector('[data-component="itemImage"] img'));

  const sellerLink = card.querySelector('[data-component="orderedMerchant"] a');
  const supplierName = text(sellerLink) || 'Amazon';

  const priceEl = card.querySelector('[data-component="unitPrice"] .a-offscreen');
  const { amount, currency } = parsePrice(priceEl ? priceEl.textContent : '');

  const reference = asinFrom(titleLink ? titleLink.href : '');

  return {
    store: 'amazon',
    description,
    imageUrl,
    productLink,
    supplierName,
    price: amount,
    currency,
    reference,
  };
}

// Order-history / your-orders list row (`yohtmlc-*` layout). No per-item price
// or seller is available here, so those are left empty for the user to fill in.
function extractList(card) {
  const titleLink = card.querySelector('.yohtmlc-product-title a');
  const description = text(titleLink);
  const productLink = normalizeProductLink(titleLink ? titleLink.href : '');

  const imageUrl = imageFrom(card.querySelector('.product-image img'));

  const reference = asinFrom(titleLink ? titleLink.href : '');

  return {
    store: 'amazon',
    description,
    imageUrl,
    productLink,
    supplierName: 'Amazon',
    price: null,
    currency: '',
    reference,
  };
}

function isDetailsRow(card) {
  return Boolean(card.querySelector('[data-component="itemTitle"]'));
}

// Prefer the high-res source Amazon stashes in `data-a-hires`, then upscale.
function imageFrom(img) {
  if (!img) return '';
  const src = img.getAttribute('data-a-hires') || img.currentSrc || img.src || '';
  return upscale(src);
}

// Amazon encodes the requested size in the filename via a `._<TOKEN>_` segment
// before the extension (e.g. `._SS284_`, `._AC_UL165_SR165,165_`). Stripping it
// requests the original-resolution image.
function upscale(url) {
  if (!url) return '';
  return url.replace(/\._[^/]+?_(\.[a-z]+)$/i, '$1');
}

// Amazon's stable product identifier, from `/dp/<ASIN>` or `/gp/product/<ASIN>`.
function asinFrom(link) {
  const m = String(link || '').match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/);
  return m ? m[1] : '';
}

// Reduce a product URL (which carries `ref=`/tracking params and an optional
// `/-/en/` locale segment) to a stable canonical `.../dp/<ASIN>` link.
function normalizeProductLink(link) {
  const asin = asinFrom(link);
  if (asin) return `https://www.amazon.es/dp/${asin}`;
  return String(link || '');
}

function text(el) {
  return ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
}
