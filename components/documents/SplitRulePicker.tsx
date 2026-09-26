"use client";

import { useState } from "react";
import { ListRow } from "@/components/ui/List";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { ProfitSplitRuleSheet } from "@/components/settings/ProfitSplitRuleSheet";
import { useMutation } from "@/lib/useMutation";
import type { DeductionType, Party, ProfitSplitRule } from "@/lib/data/types";

export type RuleOption = { id: string; name: string; scopeType: ProfitSplitRule["scopeType"] };

/**
 * Which split rule an invoice follows (item 5): its project's by default,
 * another existing rule (e.g. a venture's), or one made for this invoice only.
 */
export function SplitRulePicker({
  documentId,
  documentNumber,
  current,
  projectRuleId,
  customRule,
  currentRule,
  options,
  parties,
  deductionTypes,
}: {
  documentId: string;
  documentNumber: string;
  current: RuleOption | null;
  projectRuleId: string | null;
  customRule?: ProfitSplitRule;
  /** The rule in force now: a new custom split starts as a copy of it. */
  currentRule?: ProfitSplitRule;
  options: RuleOption[];
  parties: Party[];
  deductionTypes: DeductionType[];
}) {
  const { run } = useMutation();
  const [editing, setEditing] = useState(false);
  const applyRule = (ruleId: string | null, message: string) => run(`/api/documents/${documentId}/split-rule`, { body: { ruleId }, success: message });

  const items: MenuItem[] = [];
  if (projectRuleId && current?.id !== projectRuleId) items.push({ label: "Use the project's rule", onSelect: () => applyRule(null, "Back to the project's rule") });
  for (const o of options) {
    if (o.id === current?.id || o.id === projectRuleId || o.scopeType === "document") continue;
    items.push({ label: `${o.scopeType === "venture" ? "Venture" : "Project"}: ${o.name}`, onSelect: () => applyRule(o.id, `Now follows ${o.name}`) });
  }
  if (items.length) items.push("separator");
  items.push({ label: customRule ? "Edit this invoice's split…" : "Custom split for this invoice…", onSelect: () => setEditing(true) });
  if (customRule) items.push({ label: "Remove custom split", destructive: true, onSelect: () => applyRule(null, "Custom split removed") });

  const subtitle = current
    ? current.scopeType === "document"
      ? "Custom for this invoice"
      : `${current.id === projectRuleId ? "The project's rule" : current.scopeType === "venture" ? "Venture rule" : "Another project's rule"} · ${current.name}`
    : "None yet";

  return (
    <>
      <ListRow
        title="Split rule"
        subtitle={subtitle}
        trailing={
          <Menu
            label="Change split rule"
            items={items}
            trigger={
              <button type="button" className="press rounded-full bg-accent/15 px-3 py-1 text-subhead font-semibold text-accent">
                Change
              </button>
            }
          />
        }
      />
      <ProfitSplitRuleSheet
        open={editing}
        onOpenChange={setEditing}
        scope={{ scopeType: "document", scopeId: documentId, name: `${documentNumber} split` }}
        rule={customRule}
        template={currentRule}
        parties={parties}
        deductionTypes={deductionTypes}
      />
    </>
  );
}
