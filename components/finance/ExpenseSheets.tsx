"use client";

import { useEffect, useState } from "react";
import { FormSheet } from "@/components/ui/FormSheet";
import { FieldRow, ListSection, PlainRowInput, RowInput } from "@/components/ui/List";
import { Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { ClientProjectRows, DeleteRow, MoneyRow, type Option, type ProjectOption } from "@/components/forms/Fields";
import { useMutation } from "@/lib/useMutation";
import { minorToMajor } from "@/lib/money";
import { todayYmd } from "@/lib/time";
import { titleCase } from "@/lib/labels";
import { EXPENSE_CATEGORIES, type Currency, type RecurringExpense, type RecurringExpenseCycle } from "@/lib/data/types";
import type { ExpenseListItem } from "@/lib/data/expenses";

export type { Option, ProjectOption };

function CategoryRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = EXPENSE_CATEGORIES.includes(value as (typeof EXPENSE_CATEGORIES)[number]) || !value ? EXPENSE_CATEGORIES : [value, ...EXPENSE_CATEGORIES];
  return (
    <FieldRow label="Category">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((c) => (
          <option key={c} value={c}>
            {titleCase(c)}
          </option>
        ))}
      </Select>
    </FieldRow>
  );
}

export function ExpenseSheet({
  expense,
  onClose,
  clients,
  projects,
}: {
  expense: ExpenseListItem | null | "new";
  onClose: () => void;
  clients: Option[];
  projects: ProjectOption[];
}) {
  const { run } = useMutation();
  const confirm = useConfirm();
  const editing = expense && expense !== "new" ? expense : null;
  const [f, setF] = useState({ description: "", vendor: "", amount: "", currency: "BHD" as Currency, spentOn: todayYmd(), category: "software subscription", clientId: "", projectId: "", notes: "" });

  useEffect(() => {
    if (!expense) return;
    setF(
      editing
        ? {
            description: editing.description,
            vendor: editing.vendor ?? "",
            amount: String(minorToMajor(editing.amountCents, editing.currency)),
            currency: editing.currency,
            spentOn: editing.spentOn,
            category: editing.category,
            clientId: editing.linkedClientId ?? "",
            projectId: editing.linkedProjectId ?? "",
            notes: editing.notes ?? "",
          }
        : { description: "", vendor: "", amount: "", currency: "BHD", spentOn: todayYmd(), category: "software subscription", clientId: "", projectId: "", notes: "" },
    );
  }, [expense, editing]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    const payload = {
      description: f.description,
      vendor: f.vendor,
      amount: Number(f.amount),
      currency: f.currency,
      spentOn: f.spentOn,
      category: f.category,
      linkedClientId: f.clientId,
      linkedProjectId: f.projectId,
      notes: f.notes,
    };
    const res = editing
      ? await run(`/api/expenses/${editing.id}`, { method: "PATCH", body: payload, success: "Expense updated" })
      : await run("/api/expenses", { body: payload, success: "Expense added" });
    return !!res;
  };

  const remove = async () => {
    if (!editing) return;
    if (await confirm({ title: "Delete this expense?", destructive: true, confirmLabel: "Delete Expense" })) {
      if (await run(`/api/expenses/${editing.id}`, { method: "DELETE", success: "Expense deleted" })) onClose();
    }
  };

  return (
    <FormSheet
      open={!!expense}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? "Edit Expense" : "New Expense"}
      submitLabel={editing ? "Save" : "Add"}
      canSubmit={!!f.description.trim() && Number(f.amount) > 0 && !!f.spentOn}
      onSubmit={submit}
    >
      <ListSection>
        <PlainRowInput placeholder="What was it for?" value={f.description} onChange={(e) => set("description", e.target.value)} autoFocus={!editing} />
        <PlainRowInput placeholder="Vendor (optional)" value={f.vendor} onChange={(e) => set("vendor", e.target.value)} />
      </ListSection>
      <ListSection>
        <MoneyRow amount={f.amount} currency={f.currency} onAmount={(v) => set("amount", v)} onCurrency={(v) => set("currency", v)} />
        <FieldRow label="Date">
          <RowInput type="date" value={f.spentOn} onChange={(e) => set("spentOn", e.target.value)} />
        </FieldRow>
        <CategoryRow value={f.category} onChange={(v) => set("category", v)} />
      </ListSection>
      <ListSection header="Link to" footer="Linking to a client or project shows the cost against it.">
        <ClientProjectRows
          clients={clients}
          projects={projects}
          clientId={f.clientId}
          projectId={f.projectId}
          onClient={(v) => set("clientId", v)}
          onProject={(v) => set("projectId", v)}
        />
      </ListSection>
      <ListSection>
        <div className="px-4 py-3">
          <Textarea placeholder="Notes" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </ListSection>
      {editing && <DeleteRow label="Delete Expense" onClick={remove} />}
    </FormSheet>
  );
}

export function RecurringExpenseSheet({
  expense,
  onClose,
  clients,
  projects,
}: {
  expense: RecurringExpense | null | "new";
  onClose: () => void;
  clients: Option[];
  projects: ProjectOption[];
}) {
  const { run, pending } = useMutation();
  const confirm = useConfirm();
  const editing = expense && expense !== "new" ? expense : null;
  const blank = { name: "", amount: "", currency: "USD" as Currency, cycle: "monthly" as RecurringExpenseCycle, nextDueDate: "", category: "software subscription", clientId: "", projectId: "" };
  const [f, setF] = useState(blank);

  useEffect(() => {
    if (!expense) return;
    setF(
      editing
        ? {
            name: editing.name,
            amount: String(minorToMajor(editing.amountCents, editing.currency)),
            currency: editing.currency,
            cycle: editing.cycle,
            nextDueDate: editing.nextDueDate ?? "",
            category: editing.category,
            clientId: editing.linkedClientId ?? "",
            projectId: editing.linkedProjectId ?? "",
          }
        : blank,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense, editing]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    const payload = {
      name: f.name,
      amount: Number(f.amount),
      currency: f.currency,
      cycle: f.cycle,
      nextDueDate: f.nextDueDate,
      category: f.category,
      linkedClientId: f.clientId,
      linkedProjectId: f.projectId,
    };
    const res = editing
      ? await run(`/api/finance/recurring-expenses/${editing.id}`, { method: "PATCH", body: payload, success: "Saved" })
      : await run("/api/finance/recurring-expenses", { body: payload, success: "Recurring expense added" });
    return !!res;
  };

  const action = async (path: string, success: string) => {
    if (editing && (await run(`/api/finance/recurring-expenses/${editing.id}/${path}`, { success }))) onClose();
  };

  const remove = async () => {
    if (!editing) return;
    if (await confirm({ title: `Delete “${editing.name}”?`, message: "Expenses already logged from it are kept.", destructive: true })) {
      if (await run(`/api/finance/recurring-expenses/${editing.id}`, { method: "DELETE", success: "Deleted" })) onClose();
    }
  };

  return (
    <FormSheet
      open={!!expense}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? editing.name : "New Recurring Expense"}
      submitLabel={editing ? "Save" : "Add"}
      canSubmit={!!f.name.trim() && Number(f.amount) > 0}
      onSubmit={submit}
    >
      {editing && (
        <div className="mb-6 grid grid-cols-2 gap-3">
          <Button variant="tinted" disabled={pending || editing.status === "paused"} onClick={() => action("paid", "Logged as spent")}>
            Mark Paid
          </Button>
          <Button variant="secondary" disabled={pending} onClick={() => action("toggle", editing.status === "active" ? "Paused" : "Resumed")}>
            {editing.status === "active" ? "Pause" : "Resume"}
          </Button>
        </div>
      )}
      <ListSection>
        <PlainRowInput placeholder="Name (e.g. Microsoft 365)" value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus={!editing} />
      </ListSection>
      <ListSection>
        <MoneyRow amount={f.amount} currency={f.currency} onAmount={(v) => set("amount", v)} onCurrency={(v) => set("currency", v)} />
        <FieldRow label="Repeats">
          <Select value={f.cycle} onChange={(e) => set("cycle", e.target.value as RecurringExpenseCycle)}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Yearly</option>
          </Select>
        </FieldRow>
        <FieldRow label="Next due">
          <RowInput type="date" value={f.nextDueDate} onChange={(e) => set("nextDueDate", e.target.value)} />
        </FieldRow>
        <CategoryRow value={f.category} onChange={(v) => set("category", v)} />
      </ListSection>
      <ListSection header="Link to" footer="Costs linked to a project are deducted automatically when calculating that project's invoice profit.">
        <ClientProjectRows
          clients={clients}
          projects={projects}
          clientId={f.clientId}
          projectId={f.projectId}
          onClient={(v) => set("clientId", v)}
          onProject={(v) => set("projectId", v)}
        />
      </ListSection>
      {editing && <DeleteRow label="Delete Recurring Expense" onClick={remove} />}
    </FormSheet>
  );
}
