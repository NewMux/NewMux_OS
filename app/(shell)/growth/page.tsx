import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessGrowth } from "@/lib/rbac";
import { getAttributionMatrix, listCampaigns } from "@/lib/data/campaigns";
import { getMrrArrCents, getSubscriberBreakdown } from "@/lib/data/metrics";
import { GrowthScreen } from "./GrowthScreen";

export const metadata = { title: "Growth" };

export default async function GrowthPage() {
  const session = await auth();
  if (!canAccessGrowth(session)) redirect("/home");
  const [rows, campaigns, mrr, subs] = await Promise.all([getAttributionMatrix(), listCampaigns(), getMrrArrCents(), getSubscriberBreakdown()]);
  return <GrowthScreen rows={rows} campaigns={campaigns} mrr={mrr} subs={subs} />;
}
