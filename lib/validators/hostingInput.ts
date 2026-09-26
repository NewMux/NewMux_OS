import type { z } from "zod";
import type { hostingSubscriptionSchema } from "./hosting";
import type { HostingInput } from "@/lib/data/hosting";
import { majorToMinorUnits } from "@/lib/money";

/** Form values (major units, blanks for TBD) → the data layer's input. */
export function toHostingInput(v: z.output<typeof hostingSubscriptionSchema>): HostingInput {
  const { amount, costPerYear, costCurrency, ...rest } = v;
  return {
    ...rest,
    amountCents: amount === null ? null : majorToMinorUnits(amount, v.currency),
    costPerYearCents: costPerYear === null ? null : majorToMinorUnits(costPerYear, costCurrency ?? "BHD"),
    costCurrency: costCurrency ?? null,
  };
}
