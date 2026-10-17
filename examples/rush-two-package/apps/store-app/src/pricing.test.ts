import { describe, expect, it } from 'vitest';

import { buildCheckoutSummary } from './pricing.js';

// @scenario checkout.view-summary
// @scenario checkout.maximum-supported-cart
describe('buildCheckoutSummary', () => {
  it('returns a checkout summary using shared math logic', () => {
    expect(buildCheckoutSummary('SKU-1', 9.99, 2)).toEqual({
      sku: 'SKU-1',
      quantity: 2,
      total: 19.98,
    });
  });

  it('builds a summary for a very large cart', () => {
    expect(buildCheckoutSummary('BULK-SKU', 0.01, 999_999)).toEqual({
      sku: 'BULK-SKU',
      quantity: 999_999,
      total: 9_999.99,
    });
  });
});
