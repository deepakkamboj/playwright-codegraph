import { describe, expect, it } from 'vitest';

import { calculateTotal, formatCurrency } from './index.js';

// @scenario checkout.calculate-total
// @scenario checkout.reject-invalid-quantity
// @scenario checkout.round-fractional-total
// @scenario checkout.maximum-supported-cart
describe('calculateTotal', () => {
  it('calculates a quantity-based total', () => {
    expect(calculateTotal(12.5, 3)).toBe(37.5);
  });

  it('rejects an invalid quantity', () => {
    expect(() => calculateTotal(12.5, 0)).toThrow(/positive integer/);
  });

  it('rounds fractional currency to cents', () => {
    expect(calculateTotal(0.335, 3)).toBe(1.01);
  });

  it('calculates a very large cart deterministically', () => {
    expect(calculateTotal(0.01, 999_999)).toBe(9_999.99);
  });

  it('formats totals as currency', () => {
    expect(formatCurrency(37.5)).toBe('$37.50');
  });
});
