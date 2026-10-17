import { describe, expect, it } from 'vitest';

import { buildCheckoutSummary } from './pricing.js';

// @scenario checkout.view-summary
describe('buildCheckoutSummary', () => {
  it('returns a checkout summary using shared math logic', () => {
    expect(buildCheckoutSummary('SKU-1', 9.99, 2)).toEqual({
      sku: 'SKU-1',
      quantity: 2,
      total: 19.98,
    });
  });
});
