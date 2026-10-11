"use client";

import { useState } from "react";
import { QuickAddMenu, useCanSeeMoney } from "@/components/shell/QuickAdd";
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
  campaigns,
}: {
  deals: DealListItem[];
  totals: { count: number; totalBhdCents: number; weightedBhdCents: number };
  clients: Option[];
  contacts: ContactOption[];
  users: Option[];
  campaigns: Option[];
}) {
  const [creating, setCreating] = useState(false);
  const money = useCanSeeMoney();
  useNewParam(() => setCreating(true));
  return (
    <Page
      wide
      title="Pipeline"
      back={{ href: "/crm", label: "CRM" }}
      subtitle={money ? `${totals.count} open · ${compactMoney(totals.totalBhdCents)} total · ${compactMoney(totals.weightedBhdCents)} weighted` : `${totals.count} open`}
      actions={
        <QuickAddMenu extra={[{ label: "New deal", onSelect: () => setCreating(true) }]} />
      }
    >
      <PipelineBoard deals={deals} />
      <DealSheet open={creating} onOpenChange={setCreating} clients={clients} contacts={contacts} users={users} campaigns={campaigns} />
    </Page>
  );
}
