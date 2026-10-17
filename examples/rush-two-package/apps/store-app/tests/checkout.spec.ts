import { expect, test } from '@playwright/test';

import { buildCheckoutSummary } from '../src/pricing.js';

test('shopper views a calculated checkout summary @scenario:checkout.view-summary', async ({ request }) => {
  const expected = buildCheckoutSummary('SKU-1', 9.99, 2);
  const response = await request.get('/checkout?sku=SKU-1&price=9.99&quantity=2');

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual(expected);
});

test('invalid quantity is rejected @scenario:checkout.reject-invalid-quantity', async ({ request }) => {
  const response = await request.get('/checkout?sku=SKU-1&price=9.99&quantity=0');

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: 'quantity must be a positive integer' });
});

test('fractional total is rounded to cents @scenario:checkout.round-fractional-total', async ({ request }) => {
  const response = await request.get('/checkout?sku=SKU-EDGE&price=0.335&quantity=3');

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({ sku: 'SKU-EDGE', quantity: 3, total: 1.01 });
});

test('very large cart is calculated @scenario:checkout.maximum-supported-cart', async ({ request }) => {
  const response = await request.get('/checkout?sku=BULK-SKU&price=0.01&quantity=999999');

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({ sku: 'BULK-SKU', quantity: 999_999, total: 9_999.99 });
});
