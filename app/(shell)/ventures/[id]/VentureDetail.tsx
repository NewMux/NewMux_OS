"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Page } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ListRow, ListSection } from "@/components/ui/List";
import { VENTURE_STATUS, VentureSheet } from "@/components/company/VentureSheet";
import { ProfitSplitRuleSheet } from "@/components/settings/ProfitSplitRuleSheet";
import type { DeductionType, Party, ProfitSplitRule, Venture } from "@/lib/data/types";

export function VentureDetail({ venture, rule, parties, deductionTypes }: { venture: Venture; rule?: ProfitSplitRule; parties: Party[]; deductionTypes: DeductionType[] }) {
  const [editing, setEditing] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const status = VENTURE_STATUS[venture.launchStatus];
  return (
    <Page
      title={venture.name}
      back={{ href: "/ventures", label: "Ventures" }}
      actions={
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <Avatar name={venture.name} size={84} square />
          <div className="mt-3">
            <Badge color={status.color}>{status.label}</Badge>
          </div>
          {venture.brandDescription && <p className="mt-3 max-w-md text-body text-label-2">{venture.brandDescription}</p>}
          {venture.websiteUrl && (
            <a href={venture.websiteUrl.startsWith("http") ? venture.websiteUrl : `https://${venture.websiteUrl}`} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 text-subhead text-accent">
              {venture.websiteUrl}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <ListSection header="Ownership & Profit Split" footer="Ventures are held personally by the founders — the split is set here, not assumed.">
          {rule ? (
            rule.splits.map((s) => <ListRow key={s.partyId} title={parties.find((p) => p.id === s.partyId)?.name ?? "?"} detail={`${s.percentageBps / 100}%`} />)
          ) : (
            <ListRow title="Not configured yet" />
          )}
          <ListRow title={<span className="text-accent">{rule ? "Edit Split" : "Set Up Split"}</span>} onClick={() => setSplitOpen(true)} />
        </ListSection>
      </div>
      <VentureSheet venture={venture} open={editing} onOpenChange={setEditing} />
      <ProfitSplitRuleSheet open={splitOpen} onOpenChange={setSplitOpen} scope={{ scopeType: "venture", scopeId: venture.id, name: venture.name }} rule={rule} parties={parties} deductionTypes={deductionTypes} />
    </Page>
  );
}
