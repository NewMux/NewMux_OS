import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessGrowth } from "@/lib/rbac";
import { getAttributionMatrix, listCampaigns } from "@/lib/data/campaigns";
import { AttributionTable } from "@/components/growth/AttributionTable";
import { CampaignForm } from "@/components/growth/CampaignForm";

export default async function GrowthPage() {
  const session = await auth();
  if (!canAccessGrowth(session)) redirect("/dashboard");

  const [rows, campaigns] = await Promise.all([getAttributionMatrix(), listCampaigns()]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Growth &amp; Marketing</h1>
        <CampaignForm campaigns={campaigns} />
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Metrics are entered manually per channel (no live ad-platform API integration in this pass).
      </p>
      <AttributionTable rows={rows} />
    </div>
  );
}
