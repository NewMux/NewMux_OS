"use client";

import { useState } from "react";
import { Plus, Rocket } from "lucide-react";
import { Page, NavButton } from "@/components/ui/Page";
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
        <NavButton label="New venture" onClick={() => setCreating(true)}>
          <Plus className="h-5 w-5" />
        </NavButton>
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
