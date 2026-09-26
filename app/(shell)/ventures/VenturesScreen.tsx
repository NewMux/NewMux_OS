"use client";

import { useState } from "react";
import { Rocket } from "lucide-react";
import { QuickAddMenu } from "@/components/shell/QuickAdd";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection } from "@/components/ui/List";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { VENTURE_STATUS, VentureSheet } from "@/components/company/VentureSheet";
import type { Venture } from "@/lib/data/types";

export function VenturesScreen({ ventures }: { ventures: Venture[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <Page
      title="Ventures"
      subtitle="Products owned by the founders"
      actions={
        <QuickAddMenu extra={[{ label: "New venture", onSelect: () => setCreating(true) }]} />
      }
    >
      <div className="mx-auto max-w-2xl">
        {ventures.length === 0 && <EmptyState icon={Rocket} title="No ventures yet" />}
        <ListSection>
          {ventures.map((v) => (
            <ListRow
              key={v.id}
              href={`/ventures/${v.id}`}
              leading={<Avatar name={v.name} size={44} square />}
              title={v.name}
              subtitle={v.brandDescription ?? undefined}
              trailing={<Badge color={VENTURE_STATUS[v.launchStatus].color}>{VENTURE_STATUS[v.launchStatus].label}</Badge>}
            />
          ))}
        </ListSection>
      </div>
      <VentureSheet open={creating} onOpenChange={setCreating} />
    </Page>
  );
}
