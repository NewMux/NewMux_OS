import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessSettings } from "@/lib/rbac";
import { listParties, listDeductionTypes, listProfitSplitRules, listVentures } from "@/lib/data/finance";
import { listProjects } from "@/lib/data/projects";
import { PartiesPanel } from "@/components/settings/PartiesPanel";
import { DeductionTypesPanel } from "@/components/settings/DeductionTypesPanel";
import { ProfitSplitRuleEditor } from "@/components/settings/ProfitSplitRuleEditor";

export default async function SettingsPage() {
  const session = await auth();
  if (!canAccessSettings(session)) redirect("/dashboard");

  const [parties, deductionTypes, rules, projects, ventures] = await Promise.all([
    listParties(),
    listDeductionTypes(),
    listProfitSplitRules(),
    listProjects(),
    listVentures(),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-white">Settings</h1>
      <p className="mb-4 text-xs text-slate-500">
        Admin-only. Every change here is timestamped and attributed in the audit log.
      </p>

      <div className="flex flex-col gap-4">
        <PartiesPanel parties={parties} />
        <DeductionTypesPanel deductionTypes={deductionTypes} />
        <ProfitSplitRuleEditor parties={parties} deductionTypes={deductionTypes} rules={rules} projects={projects} ventures={ventures} />
      </div>
    </div>
  );
}
