// Store adapter for the AliExpress orders page.
//
// A StoreAdapter isolates the fragile, site-specific selectors so a new store
// (e.g. Amazon) can be added as another adapter without touching the content
// script. Shape:
//   matches(url): boolean
//   findCards(root?): Element[]           // order cards on the page
//   getButtonMount(card): Element|null    // where to place our buttons
//   extract(card): CapturedItem           // scraped fields
//
// CapturedItem = { store, description, imageUrl, productLink, supplierName,
//                  price: number|null, currency, reference }

import { parsePrice } from '../shared/price.js';

export const aliexpressAdapter = {
  id: 'aliexpress',

  matches(url) {
    return /^https:\/\/www\.aliexpress\.com\/p\/order\//.test(String(url || ''));
  },

  findCards(root = document) {
    return Array.from(root.querySelectorAll('.order-item'));
  },

  getButtonMount(card) {
    return (
      card.querySelector('.order-item-btns') ||
      card.querySelector('.order-item-btns-wrap') ||
      card
    );
  },

  extract(card) {
    const nameEl =
      card.querySelector('.order-item-content-info-name span[title]') ||
      card.querySelector('.order-item-content-info-name');
    const description = (
      (nameEl && (nameEl.getAttribute('title') || nameEl.textContent)) || ''
    ).trim();

    const linkEl = card.querySelector('a[href*="/item/"]');
    const productLink = linkEl ? linkEl.href : '';

    const imageUrl = extractImage(card);

    const storeEl = card.querySelector('.order-item-store-name');
    const supplierName = ((storeEl && storeEl.textContent) || '').trim() || 'AliExpress';

    const priceEl = card.querySelector('.order-item-content-info-number');
    const { amount, currency } = parsePrice(priceEl ? priceEl.textContent : '');

    const reference = productIdFromLink(productLink) || skuText(card);

    return {
      store: 'aliexpress',
      description,
      imageUrl,
      productLink,
      supplierName,
      price: amount,
      currency,
      reference,
    };
  },
};

function extractImage(card) {
  const imgEl = card.querySelector('.order-item-content-img');
  if (imgEl) {
    const bg = imgEl.style.backgroundImage || getComputedStyle(imgEl).backgroundImage;
    const m = bg && bg.match(/url\(["']?(.*?)["']?\)/);
    if (m && m[1]) return upscale(m[1]);
  }
  const realImg = card.querySelector('.order-item-content-body img, .order-item-content-img img');
  return realImg ? upscale(realImg.currentSrc || realImg.src) : '';
}

// Strip the CDN size suffix (e.g. "_220x220.png" or "_480x480q75.jpg_.avif")
// to request the original image when the pattern is present.
function upscale(url) {
  if (!url) return '';
  return url.replace(/&quot;/g, '').replace(/_\d+x\d+[^/]*$/, '');
}

function productIdFromLink(link) {
  const m = String(link || '').match(/\/item\/(\d+)\.html/);
  return m ? m[1] : '';
}

function skuText(card) {
  const el = card.querySelector('.order-item-content-info-sku');
  return el ? el.textContent.trim() : '';
}
