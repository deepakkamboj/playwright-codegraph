import { expect, test } from '@playwright/test';

import { buildCheckoutSummary } from '../src/pricing.js';

test('shopper views a calculated checkout summary @scenario:checkout.view-summary', async ({ request }) => {
  const expected = buildCheckoutSummary('SKU-1', 9.99, 2);
  const response = await request.get('/checkout?sku=SKU-1&price=9.99&quantity=2');

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual(expected);
});
