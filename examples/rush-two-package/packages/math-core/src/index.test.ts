import { describe, expect, it } from 'vitest';

import { calculateTotal, formatCurrency } from './index.js';

// @scenario checkout.calculate-total
describe('calculateTotal', () => {
  it('calculates a quantity-based total', () => {
    expect(calculateTotal(12.5, 3)).toBe(37.5);
  });

  it('rejects an invalid quantity', () => {
    expect(() => calculateTotal(12.5, 0)).toThrow(/positive integer/);
  });

  it('formats totals as currency', () => {
    expect(formatCurrency(37.5)).toBe('$37.50');
  });
});
