// Price parsing for scraped order cards.
// AliExpress renders each price character in its own element to deter copying,
// but `textContent` still concatenates them (e.g. "8,79 €"). We also handle
// locale variations: comma-decimal ("8,79"), dot-decimal ("8.79"), and
// thousands separators ("1.234,56" or "1,234.56").

/**
 * Parse a raw price string into a numeric amount and a currency token.
 * @param {string} raw
 * @returns {{ amount: number|null, currency: string, raw: string }}
 */
export function parsePrice(raw) {
  const text = String(raw ?? '').replace(/ /g, ' ').trim();
  const currency = text.replace(/[\d.,]/g, '').replace(/\s+/g, ' ').trim();
  return { amount: parseAmount(text), currency, raw: text };
}

/**
 * Extract a decimal amount from a string that may contain currency symbols and
 * grouping separators.
 * @param {string} input
 * @returns {number|null}
 */
export function parseAmount(input) {
  const cleaned = String(input ?? '').replace(/[^\d.,]/g, '');
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized;
  if (lastComma === -1 && lastDot === -1) {
    normalized = cleaned;
  } else {
    // The separator that appears last is the decimal separator; the other is a
    // thousands separator and is removed.
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandsSep = decimalSep === ',' ? '.' : ',';
    normalized = cleaned.split(thousandsSep).join('').replace(decimalSep, '.');
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
