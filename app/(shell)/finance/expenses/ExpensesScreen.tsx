"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Receipt, Repeat } from "lucide-react";
import { Page, NavButton } from "@/components/ui/Page";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ListRow, ListSection } from "@/components/ui/List";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { SearchField } from "@/components/ui/SearchField";
import { ExpenseSheet, RecurringExpenseSheet, type ExpenseLinks } from "@/components/finance/ExpenseSheets";
import { useNewParam } from "@/lib/hooks/useNewParam";
import { centsToDisplay, convertMinorUnits } from "@/lib/money";
import { formatDate, relativeDay, daysUntil } from "@/lib/time";
import { CYCLE_LABEL, titleCase } from "@/lib/labels";
import type { ExpenseListItem } from "@/lib/data/expenses";
import type { RecurringExpense } from "@/lib/data/types";

export function ExpensesScreen({ expenses, recurring, links }: { expenses: ExpenseListItem[]; recurring: RecurringExpense[]; links: ExpenseLinks }) {
  const params = useSearchParams();
  const [tab, setTab] = useState<"spent" | "recurring">(params.get("tab") === "recurring" ? "recurring" : "spent");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<ExpenseListItem | null | "new">(null);
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null | "new">(null);
  // ?fund=<id> (Spend from the reserve) prefills the fund on a new expense.
  const [fundId] = useState(params.get("fund") ?? undefined);
  useNewParam(() => setEditing("new"));
  // ?id=<expense> opens it (links from account statements and fund pages).
  useEffect(() => {
    const id = params.get("id");
    const found = id ? expenses.find((e) => e.id === id) : undefined;
    if (found) setEditing(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term
      ? expenses.filter((e) => [e.description, e.vendor, e.category, e.projectName, e.clientName, e.ventureName, e.paidByName, e.fundName].some((v) => v?.toLowerCase().includes(term)))
      : expenses;
  }, [expenses, q]);

  const byMonth = useMemo(() => {
    const groups = new Map<string, ExpenseListItem[]>();
    for (const e of filtered) groups.set(e.spentOn.slice(0, 7), [...(groups.get(e.spentOn.slice(0, 7)) ?? []), e]);
    return [...groups.entries()];
  }, [filtered]);

  const monthlyRunRate = recurring
    .filter((r) => r.status === "active")
    .reduce((sum, r) => sum + convertMinorUnits(r.amountCents, r.currency, "BHD") / { monthly: 1, quarterly: 3, annual: 12 }[r.cycle], 0);

  return (
    <Page
      title="Expenses"
      back={{ href: "/finance", label: "Finance" }}
      actions={
        <NavButton label="Add expense" onClick={() => (tab === "spent" ? setEditing("new") : setEditingRecurring("new"))}>
          <Plus className="h-5 w-5" />
        </NavButton>
      }
      accessory={
        <div className="space-y-3">
          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={[
              { value: "spent", label: "Spent" },
              { value: "recurring", label: "Recurring" },
            ]}
          />
          {tab === "spent" && <SearchField value={q} onChange={setQ} placeholder="Search expenses" />}
        </div>
      }
    >
      {tab === "spent" ? (
        <>
          {byMonth.length === 0 && (
            <EmptyState icon={Receipt} title="No expenses" message="Log what you spend so profit and cash flow stay accurate." />
          )}
          {byMonth.map(([month, items]) => {
            const total = items.reduce((s, e) => s + (e.amountBhdCents ?? convertMinorUnits(e.amountCents, e.currency, "BHD")), 0);
            return (
              <ListSection key={month} header={formatDate(`${month}-01`, { month: "long", year: "numeric" })} action={<span className="text-footnote text-label-2 tabular">{centsToDisplay(total, "BHD")}</span>}>
                {items.map((e) => (
                  <ListRow
                    key={e.id}
                    onClick={() => setEditing(e)}
                    title={e.description}
                    subtitle={
                      <>
                        {[formatDate(e.spentOn, { day: "numeric", month: "short" }), titleCase(e.category), e.ventureName ?? e.projectName ?? e.clientName ?? e.vendor].filter(Boolean).join(" · ")}
                        {(e.reimbursementStatus === "pending" || e.fundName || e.receiptFileId) && (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {e.reimbursementStatus === "pending" && <Badge color="orange">Owed to {e.paidByName}</Badge>}
                            {e.fundName && <Badge color="purple">{e.fundName}</Badge>}
                            {e.receiptFileId && <Badge>Receipt</Badge>}
                          </span>
                        )}
                      </>
                    }
                    detail={
                      <span className="flex flex-col items-end">
                        <span className="text-label">{centsToDisplay(e.amountCents, e.currency)}</span>
                        {e.currency !== "BHD" && e.amountBhdCents !== null && <span className="text-caption1 text-label-2">{centsToDisplay(e.amountBhdCents, "BHD")}</span>}
                      </span>
                    }
                    trailing={e.recurringExpenseId ? <Repeat className="h-3.5 w-3.5 text-label-3" /> : undefined}
                    multiline
                  />
                ))}
              </ListSection>
            );
          })}
        </>
      ) : (
        <ListSection header="Subscriptions & bills" footer={`≈ ${centsToDisplay(Math.round(monthlyRunRate), "BHD")} per month while active. Mark one paid to log it as spent and roll its due date forward.`}>
          {recurring.map((r) => {
            const days = r.nextDueDate ? daysUntil(r.nextDueDate) : null;
            return (
              <ListRow
                key={r.id}
                onClick={() => setEditingRecurring(r)}
                title={r.name}
                subtitle={`${CYCLE_LABEL[r.cycle]} · ${r.status === "paused" ? "Paused" : r.nextDueDate ? `next ${relativeDay(r.nextDueDate)}` : "no due date"}`}
                detail={centsToDisplay(r.amountCents, r.currency)}
                trailing={
                  r.status === "paused" ? (
                    <Badge>Paused</Badge>
                  ) : days !== null && days < 0 ? (
                    <Badge color="red">Overdue</Badge>
                  ) : days !== null && days <= 7 ? (
                    <Badge color="orange">Due soon</Badge>
                  ) : undefined
                }
              />
            );
          })}
          {recurring.length === 0 && <ListRow title="No recurring expenses" />}
        </ListSection>
      )}

      <ExpenseSheet expense={editing} onClose={() => setEditing(null)} links={links} defaultFundId={fundId} />
      <RecurringExpenseSheet expense={editingRecurring} onClose={() => setEditingRecurring(null)} links={links} />
    </Page>
  );
}
