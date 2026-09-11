import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrice, parseAmount } from './price.js';

test('parses AliExpress comma-decimal price with trailing euro', () => {
  const { amount, currency } = parsePrice('8,79 €');
  assert.equal(amount, 8.79);
  assert.equal(currency, '€');
});

test('parses concatenated split-character price', () => {
  // What textContent yields when digits are in separate spans.
  const { amount, currency } = parsePrice('8,79€');
  assert.equal(amount, 8.79);
  assert.equal(currency, '€');
});

test('parses dot-decimal with leading currency', () => {
  const { amount, currency } = parsePrice('US $12.34');
  assert.equal(amount, 12.34);
  assert.equal(currency, 'US $');
});

test('parses EU thousands separator (dot) with comma decimal', () => {
  assert.equal(parseAmount('1.234,56'), 1234.56);
});

test('parses US thousands separator (comma) with dot decimal', () => {
  assert.equal(parseAmount('1,234.56'), 1234.56);
});

test('parses integer amount without separators', () => {
  assert.equal(parseAmount('17 €'), 17);
});

test('returns null for empty / non-numeric input', () => {
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('Total:'), null);
  assert.equal(parsePrice(null).amount, null);
});
