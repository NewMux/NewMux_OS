import { auth } from "@/lib/auth";
import { isPartnerAdmin } from "@/lib/rbac";
import { listDeductionTypes, listParties, listProfitSplitRules, listVentures } from "@/lib/data/finance";
import { listProjects } from "@/lib/data/projects";
import { SettingsScreen } from "@/components/settings/SettingsScreen";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = (await auth())!;
  const admin = isPartnerAdmin(session);
  const [parties, deductionTypes, rules, projects, ventures] = admin
    ? await Promise.all([listParties(), listDeductionTypes(), listProfitSplitRules(), listProjects(), listVentures()])
    : [[], [], [], [], []];
  return (
    <SettingsScreen
      user={{ name: session.user.name ?? "", email: session.user.email ?? "", role: session.user.role }}
      admin={admin}
      parties={parties}
      deductionTypes={deductionTypes}
      rules={rules}
      scopes={[
        ...projects.map((p) => ({ scopeType: "project" as const, scopeId: p.id, name: p.name })),
        ...ventures.map((v) => ({ scopeType: "venture" as const, scopeId: v.id, name: v.name })),
      ]}
      dbMode={process.env.DATABASE_URL ? "Supabase Postgres" : "Local database (PGlite)"}
    />
  );
}
