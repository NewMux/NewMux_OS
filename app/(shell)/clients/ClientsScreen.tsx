"use client";

import { useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { QuickAddMenu } from "@/components/shell/QuickAdd";
import { Page } from "@/components/ui/Page";
import { SearchField } from "@/components/ui/SearchField";
import { ListRow, ListSection } from "@/components/ui/List";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClientSheet } from "@/components/crm/CrmSheets";
import { useNewParam } from "@/lib/hooks/useNewParam";
import type { ClientWithStats } from "@/lib/data/clients";

export function ClientsScreen({ clients }: { clients: ClientWithStats[] }) {
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  useNewParam(() => setCreating(true));

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? clients.filter((c) => [c.name, c.clientCode, c.industry, c.primaryContactName].some((v) => v?.toLowerCase().includes(term))) : clients;
  }, [clients, q]);

  return (
    <Page
      title="Clients"
      back={{ href: "/crm", label: "CRM" }}
      actions={
        <QuickAddMenu extra={[{ label: "New client", onSelect: () => setCreating(true) }]} />
      }
      accessory={<SearchField value={q} onChange={setQ} placeholder={`Search ${clients.length} clients`} />}
    >
      {visible.length === 0 ? (
        <EmptyState icon={Building2} title={q ? "No matches" : "No clients yet"} message={q ? undefined : "Add the companies you work with."} />
      ) : (
        <ListSection>
          {visible.map((c) => (
            <ListRow
              key={c.id}
              href={`/clients/${c.id}`}
              leading={<Avatar name={c.name} size={40} square />}
              title={c.name}
              subtitle={[c.industry, c.primaryContactName].filter(Boolean).join(" · ") || c.clientCode}
              trailing={
                <span className="flex gap-1">
                  {c.openDealCount > 0 && <Badge color="indigo">{c.openDealCount} deal{c.openDealCount > 1 ? "s" : ""}</Badge>}
                  {c.outstandingInvoiceCount > 0 && <Badge color="orange">{c.outstandingInvoiceCount} due</Badge>}
                </span>
              }
            />
          ))}
        </ListSection>
      )}
      <ClientSheet open={creating} onOpenChange={setCreating} />
    </Page>
  );
}
