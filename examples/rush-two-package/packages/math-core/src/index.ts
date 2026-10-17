export function calculateTotal(unitPrice: number, quantity: number): number {
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new RangeError('unitPrice must be a non-negative finite number');
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new RangeError('quantity must be a positive integer');
  }
  return Math.round(unitPrice * quantity * 100) / 100;
}

export function formatCurrency(total: number): string {
  if (!Number.isFinite(total) || total < 0) {
    throw new RangeError('total must be a non-negative finite number');
  }
  return `$${total.toFixed(2)}`;
}
