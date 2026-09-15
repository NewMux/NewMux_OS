import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { listDeals, listOutreachForDeal } from "@/lib/data/deals";
import { listUsers } from "@/lib/data/users";
import { DealKanban } from "@/components/pipeline/DealKanban";
import { AddDealModal } from "@/components/pipeline/AddDealModal";
import type { OutreachActivity } from "@/lib/data/types";

export default async function PipelinePage() {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/dashboard");

  const [deals, users] = await Promise.all([listDeals(), listUsers()]);

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
          <h1 className="text-xl font-semibold text-white">Outbound Outreach &amp; Deal Pipeline</h1>
          <p className="text-xs text-slate-500">Log every call/email/WhatsApp touch, then move deals through the funnel. Won deals convert instantly.</p>
        </div>
        <AddDealModal owners={users} />
      </div>

      <DealKanban deals={deals} ownerNames={ownerNames} lastOutreach={lastOutreach} />
    </div>
  );
}
