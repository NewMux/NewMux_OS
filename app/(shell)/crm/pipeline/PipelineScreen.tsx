"use client";

import { useState } from "react";
import { QuickAddMenu } from "@/components/shell/QuickAdd";
import { Page } from "@/components/ui/Page";
import { PipelineBoard } from "@/components/crm/PipelineBoard";
import { DealSheet, type ContactOption } from "@/components/crm/CrmSheets";
import type { Option } from "@/components/forms/Fields";
import { useNewParam } from "@/lib/hooks/useNewParam";
import { compactMoney } from "@/lib/money";
import type { DealListItem } from "@/lib/data/crm";

export function PipelineScreen({
  deals,
  totals,
  clients,
  contacts,
  users,
}: {
  deals: DealListItem[];
  totals: { count: number; totalBhdCents: number; weightedBhdCents: number };
  clients: Option[];
  contacts: ContactOption[];
  users: Option[];
}) {
  const [creating, setCreating] = useState(false);
  useNewParam(() => setCreating(true));
  return (
    <Page
      wide
      title="Pipeline"
      back={{ href: "/crm", label: "CRM" }}
      subtitle={`${totals.count} open · ${compactMoney(totals.totalBhdCents)} total · ${compactMoney(totals.weightedBhdCents)} weighted`}
      actions={
        <QuickAddMenu extra={[{ label: "New deal", onSelect: () => setCreating(true) }]} />
      }
    >
      <PipelineBoard deals={deals} />
      <DealSheet open={creating} onOpenChange={setCreating} clients={clients} contacts={contacts} users={users} />
    </Page>
  );
}
