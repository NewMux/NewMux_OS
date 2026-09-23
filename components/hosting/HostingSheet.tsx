"use client";

import { useEffect, useState } from "react";
import { FormSheet } from "@/components/ui/FormSheet";
import { FieldRow, ListSection, PlainRowInput, RowInput } from "@/components/ui/List";
import { Select } from "@/components/ui/Input";
import { useConfirm } from "@/components/ui/Confirm";
import { ClientProjectRows, DeleteRow, MoneyRow, type Option, type ProjectOption } from "@/components/forms/Fields";
import { useMutation } from "@/lib/useMutation";
import { minorToMajor } from "@/lib/money";
import type { HostingListItem } from "@/lib/data/hosting";
import type { Currency, HostingItemType, HostingSubscriptionStatus, RecurringExpenseCycle } from "@/lib/data/types";

export function HostingSheet({ sub, onClose, clients, projects }: { sub: HostingListItem | null | "new"; onClose: () => void; clients: Option[]; projects: ProjectOption[] }) {
  const { run } = useMutation();
  const confirm = useConfirm();
  const editing = sub && sub !== "new" ? sub : null;
  const blank = {
    clientId: "",
    projectId: "",
    item: "server" as HostingItemType,
    label: "",
    amount: "",
    currency: "BHD" as Currency,
    cycle: "quarterly" as RecurringExpenseCycle,
    nextDueDate: "",
    status: "active" as HostingSubscriptionStatus,
  };
  const [f, setF] = useState(blank);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!sub) return;
    setF(
      editing
        ? {
            clientId: editing.clientId,
            projectId: editing.projectId ?? "",
            item: editing.item,
            label: editing.label ?? "",
            amount: String(minorToMajor(editing.amountCents, editing.currency)),
            currency: editing.currency,
            cycle: editing.cycle,
            nextDueDate: editing.nextDueDate ?? "",
            status: editing.status,
          }
        : blank,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub, editing]);

  const submit = async () => {
    const payload = { ...f, amount: Number(f.amount) };
    return !!(editing
      ? await run(`/api/hosting/${editing.id}`, { method: "PATCH", body: payload, success: "Saved" })
      : await run("/api/hosting", { body: payload, success: "Hosting fee added" }));
  };

  const remove = async () => {
    if (!editing) return;
    if (await confirm({ title: `Stop tracking this fee for ${editing.clientName}?`, message: "Invoices already issued are kept.", destructive: true })) {
      if (await run(`/api/hosting/${editing.id}`, { method: "DELETE", success: "Deleted" })) onClose();
    }
  };

  return (
    <FormSheet
      open={!!sub}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? "Hosting Fee" : "New Hosting Fee"}
      submitLabel={editing ? "Save" : "Add"}
      canSubmit={!!f.clientId && Number(f.amount) > 0}
      onSubmit={submit}
    >
      <ListSection>
        <ClientProjectRows clients={clients} projects={projects} clientId={f.clientId} projectId={f.projectId} onClient={(v) => set("clientId", v)} onProject={(v) => set("projectId", v)} />
      </ListSection>
      <ListSection>
        <FieldRow label="Item">
          <Select value={f.item} onChange={(e) => set("item", e.target.value as HostingItemType)}>
            <option value="server">Server / hosting</option>
            <option value="domain">Domain</option>
            <option value="other">Other</option>
          </Select>
        </FieldRow>
        <PlainRowInput placeholder="Label (e.g. example.com domain)" value={f.label} onChange={(e) => set("label", e.target.value)} />
        <MoneyRow amount={f.amount} currency={f.currency} onAmount={(v) => set("amount", v)} onCurrency={(v) => set("currency", v)} />
        <FieldRow label="Billed">
          <Select value={f.cycle} onChange={(e) => set("cycle", e.target.value as RecurringExpenseCycle)}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Yearly</option>
          </Select>
        </FieldRow>
        <FieldRow label="Next due">
          <RowInput type="date" value={f.nextDueDate} onChange={(e) => set("nextDueDate", e.target.value)} />
        </FieldRow>
        {editing && (
          <FieldRow label="Status">
            <Select value={f.status} onChange={(e) => set("status", e.target.value as HostingSubscriptionStatus)}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="overdue">Overdue</option>
            </Select>
          </FieldRow>
        )}
      </ListSection>
      {editing && <DeleteRow label="Delete Hosting Fee" onClick={remove} />}
    </FormSheet>
  );
}
