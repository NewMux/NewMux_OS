import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { listDeals, listOutreachForDeal, listFollowUpReminders, getPipelineAnalytics } from "@/lib/data/deals";
import { listUsers } from "@/lib/data/users";
import { DealKanban } from "@/components/pipeline/DealKanban";
import { AddDealModal } from "@/components/pipeline/AddDealModal";
import { FollowUpsPanel } from "@/components/pipeline/FollowUpsPanel";
import { PipelineAnalytics } from "@/components/pipeline/PipelineAnalytics";
import type { OutreachActivity } from "@/lib/data/types";

export default async function PipelinePage() {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/dashboard");

  const [deals, users, reminders, analytics] = await Promise.all([
    listDeals(),
    listUsers(),
    listFollowUpReminders(),
    getPipelineAnalytics(),
  ]);

  const outreachByDeal = await Promise.all(deals.map((d) => listOutreachForDeal(d.id)));
  const lastOutreach: Record<string, OutreachActivity | undefined> = {};
  deals.forEach((d, i) => {
    lastOutreach[d.id] = outreachByDeal[i]?.[0];
  });

  const ownerNames: Record<string, string> = {};
  users.forEach((u) => {
    ownerNames[u.id] = u.fullName;
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Outbound Outreach &amp; Deal Pipeline</h1>
          <p className="text-xs text-muted-foreground">Drag deals between stages. Dropping into Won converts the deal instantly.</p>
        </div>
        <AddDealModal owners={users} />
      </div>

      <FollowUpsPanel reminders={reminders} ownerNames={ownerNames} />

      <div className="mb-6">
        <DealKanban deals={deals} ownerNames={ownerNames} lastOutreach={lastOutreach} />
      </div>

      <h2 className="mb-3 text-sm font-semibold text-secondary-foreground">Pipeline Analytics</h2>
      <PipelineAnalytics analytics={analytics} />
    </div>
  );
}
