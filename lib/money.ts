/**
 * All money is stored and computed as integer cents to avoid float rounding.
 * v1 assumes single-currency USD throughout (no FX table) — see plan assumptions.
 */

export function centsToDisplay(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function lineItemTotalCents(quantity: number, unitPriceCents: number): number {
  return Math.round(quantity * unitPriceCents);
}

export function subtotalCents(lineItems: { quantity: number; unitPriceCents: number }[]): number {
  return lineItems.reduce((sum, item) => sum + lineItemTotalCents(item.quantity, item.unitPriceCents), 0);
}

/** taxRateBps is in basis points, e.g. 800 = 8.00% */
export function taxCents(subtotal: number, taxRateBps: number): number {
  return Math.round((subtotal * taxRateBps) / 10000);
}

export function totalCents(subtotal: number, tax: number): number {
  return subtotal + tax;
}
