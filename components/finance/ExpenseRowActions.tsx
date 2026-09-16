"use client";

import { EntityRowActions } from "@/components/entity/EntityRowActions";
import { minorUnitsToMajor, minorUnitDigits } from "@/lib/money";
import type { RecurringExpense } from "@/lib/data/types";

function toDateInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

export function ExpenseRowActions({ expense }: { expense: RecurringExpense }) {
  const digits = minorUnitDigits(expense.currency);
  return (
    <EntityRowActions
      label="expense"
      name={expense.name}
      endpoint={`/api/finance/recurring-expenses/${expense.id}`}
      deleteDescription="Past profit calculations already recorded are unaffected. This cannot be undone."
      fields={[
        {
          name: "name",
          label: "Expense name",
          value: expense.name,
          required: true,
        },
        {
          name: "category",
          label: "Category",
          value: expense.category,
          required: true,
        },
        {
          name: "amount",
          label: `Amount (${expense.currency})`,
          type: "number",
          step: (1 / 10 ** digits).toFixed(digits),
          value: String(
            minorUnitsToMajor(expense.amountCents, expense.currency),
          ),
          required: true,
        },
        {
          name: "cycle",
          label: "Billing cycle",
          type: "select",
          value: expense.cycle,
          options: [
            { value: "monthly", label: "Monthly" },
            { value: "quarterly", label: "Quarterly" },
            { value: "annual", label: "Annual" },
          ],
        },
        {
          name: "nextDueDate",
          label: "Next due date",
          type: "date",
          value: toDateInput(expense.nextDueDate),
        },
        {
          name: "lastPaymentDate",
          label: "Last paid",
          type: "date",
          value: toDateInput(expense.lastPaymentDate),
        },
      ]}
    />
  );
}
