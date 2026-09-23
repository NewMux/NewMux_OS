"use client";

import { FieldRow, RowInput } from "@/components/ui/List";
import { Select } from "@/components/ui/Input";
import type { Currency } from "@/lib/data/types";

export type Option = { id: string; name: string };
export type ProjectOption = Option & { clientId: string | null };

/** Amount + currency on one row, with a decimal keypad on iPhone. */
export function MoneyRow({
  label = "Amount",
  amount,
  currency,
  onAmount,
  onCurrency,
}: {
  label?: string;
  amount: string;
  currency: Currency;
  onAmount: (v: string) => void;
  onCurrency: (v: Currency) => void;
}) {
  return (
    <FieldRow label={label}>
      <RowInput
        inputMode="decimal"
        placeholder={currency === "BHD" ? "0.000" : "0.00"}
        value={amount}
        onChange={(e) => onAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        className="w-28 tabular"
      />
      <Select value={currency} onChange={(e) => onCurrency(e.target.value as Currency)} className="ml-2 w-auto" aria-label="Currency">
        <option value="BHD">BHD</option>
        <option value="USD">USD</option>
      </Select>
    </FieldRow>
  );
}

/** Client → Project pickers; the project list narrows to the chosen client. */
export function ClientProjectRows({
  clients,
  projects,
  clientId,
  projectId,
  onClient,
  onProject,
  clientLabel = "Client",
}: {
  clients: Option[];
  projects: ProjectOption[];
  clientId: string;
  projectId: string;
  onClient: (v: string) => void;
  onProject: (v: string) => void;
  clientLabel?: string;
}) {
  const visibleProjects = clientId ? projects.filter((p) => p.clientId === clientId) : projects;
  return (
    <>
      <FieldRow label={clientLabel}>
        <Select
          value={clientId}
          onChange={(e) => {
            onClient(e.target.value);
            if (projectId && !projects.some((p) => p.id === projectId && p.clientId === e.target.value)) onProject("");
          }}
        >
          <option value="">None</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </FieldRow>
      <FieldRow label="Project">
        <Select
          value={projectId}
          onChange={(e) => {
            onProject(e.target.value);
            const p = projects.find((x) => x.id === e.target.value);
            if (p?.clientId && !clientId) onClient(p.clientId);
          }}
        >
          <option value="">None</option>
          {visibleProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </FieldRow>
    </>
  );
}

/** Destructive full-width button row at the bottom of an edit sheet. */
export function DeleteRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="mb-6 overflow-hidden rounded-[12px] bg-bg-elevated">
      <button type="button" onClick={onClick} className="flex min-h-[44px] w-full items-center justify-center text-body text-ios-red active:bg-fill/20">
        {label}
      </button>
    </div>
  );
}
