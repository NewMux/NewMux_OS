/**
 * All money is stored and computed as an integer number of the currency's
 * smallest unit ("minor units") to avoid float rounding — e.g. 1500 = $15.00
 * for USD, but 15000 = 15.000 BHD for BHD, which has 3 decimal places
 * (fils), not 2. Newmux invoices real amounts in both USD and BHD (PRD
 * section 17's worked example uses 3-decimal BHD figures), so the divisor
 * must be currency-aware rather than a hardcoded /100.
 */

const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "KWD", "OMR", "JOD", "TND"]);
const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW"]);

export function minorUnitDigits(currency: string): number {
  if (THREE_DECIMAL_CURRENCIES.has(currency)) return 3;
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) return 0;
  return 2;
}

export function centsToDisplay(amountMinorUnits: number, currency = "USD"): string {
  const digits = minorUnitDigits(currency);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amountMinorUnits / 10 ** digits);
}

/** "1,172.951" — the amount without its currency code, for dense tables where the code is shown once. */
export function formatAmount(amountMinorUnits: number, currency = "BHD"): string {
  const digits = minorUnitDigits(currency);
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amountMinorUnits / 10 ** digits);
}

/** An amount that may not be agreed yet (hosting fees, item 13). */
export function amountOrTbd(amountMinorUnits: number | null, currency = "BHD"): string {
  return amountMinorUnits === null ? "Amount TBD" : centsToDisplay(amountMinorUnits, currency);
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Currency-aware version of dollarsToCents, for non-USD amounts (e.g. BHD). */
export function majorToMinorUnits(amount: number, currency = "USD"): number {
  return Math.round(amount * 10 ** minorUnitDigits(currency));
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

/**
 * BHD is pegged to the US dollar at a fixed, official rate (not a floating
 * market rate), so a small fixed table is accurate here — this is not the
 * kind of live FX rate lookup the rest of the app deliberately avoids.
 * 1 BHD = 2.6596 USD (official peg) → 1 USD ≈ 0.376 BHD.
 */
const USD_PER_UNIT: Record<string, number> = {
  USD: 1,
  BHD: 2.6596,
};

/** Converts an integer minor-units amount from one currency to another. */
export function convertMinorUnits(amountMinorUnits: number, fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) return amountMinorUnits;
  const fromRate = USD_PER_UNIT[fromCurrency];
  const toRate = USD_PER_UNIT[toCurrency];
  if (!fromRate || !toRate) {
    throw new Error(`No fixed FX rate configured for ${fromCurrency} → ${toCurrency}`);
  }
  const fromMajor = amountMinorUnits / 10 ** minorUnitDigits(fromCurrency);
  const usdMajor = fromMajor * fromRate;
  const toMajor = usdMajor / toRate;
  return Math.round(toMajor * 10 ** minorUnitDigits(toCurrency));
}

/**
 * Splits `total` minor units by basis-point shares so the parts always sum
 * back to `total` exactly (largest-remainder method) — per-part rounding
 * alone can drift by a fils/cent.
 */
export function allocateByBps(total: number, sharesBps: number[]): number[] {
  const sumBps = sharesBps.reduce((a, b) => a + b, 0);
  if (sumBps === 0) return sharesBps.map(() => 0);
  const exact = sharesBps.map((bps) => (total * bps) / sumBps);
  const floored = exact.map((x) => Math.floor(x));
  let remainder = total - floored.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; remainder > 0 && k < order.length; k++, remainder--) floored[order[k]!.i]! += 1;
  return floored;
}

/** Converts minor units to a plain major-unit number (for form inputs). */
export function minorToMajor(amountMinorUnits: number, currency = "USD"): number {
  return amountMinorUnits / 10 ** minorUnitDigits(currency);
}

/** Compact display for widgets: "BHD 1.2K", "$15.3K". */
export function compactMoney(amountMinorUnits: number, currency = "BHD"): string {
  const major = minorToMajor(amountMinorUnits, currency);
  const formatted = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(major);
  return currency === "USD" ? `$${formatted}` : `${currency} ${formatted}`;
}
