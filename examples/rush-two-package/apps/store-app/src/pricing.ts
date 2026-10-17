import { calculateTotal } from '@demo/math-core';

export interface CheckoutSummary {
  readonly sku: string;
  readonly quantity: number;
  readonly total: number;
}

export function buildCheckoutSummary(sku: string, unitPrice: number, quantity: number): CheckoutSummary {
  if (!sku.trim()) throw new Error('sku is required');
  return {
    sku,
    quantity,
    total: calculateTotal(unitPrice, quantity),
  };
}
