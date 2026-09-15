import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessSettings } from "@/lib/rbac";
import { listParties, listDeductionTypes, listProfitSplitRules, listVentures } from "@/lib/data/finance";
import { listProjects } from "@/lib/data/projects";
import { PartiesPanel } from "@/components/settings/PartiesPanel";
import { DeductionTypesPanel } from "@/components/settings/DeductionTypesPanel";
import { ProfitSplitRuleEditor } from "@/components/settings/ProfitSplitRuleEditor";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";

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
      <h1 className="mb-1 text-xl font-semibold text-foreground">Settings</h1>
      <p className="mb-4 text-xs text-muted-foreground">
        Admin-only. Every change here is timestamped and attributed in the audit log.
      </p>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Saved on this device. &ldquo;System&rdquo; follows your operating system setting.
            </p>
            <ThemeToggle showLabels />
          </div>
        </Card>

        <PartiesPanel parties={parties} />
        <DeductionTypesPanel deductionTypes={deductionTypes} />
        <ProfitSplitRuleEditor parties={parties} deductionTypes={deductionTypes} rules={rules} projects={projects} ventures={ventures} />
      </div>
    </div>
  );
}
