import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessMarketing, canSeeMoney } from "@/lib/rbac";
import { listMarketingCampaigns, marketingOptions } from "@/lib/data/marketing";
import { CampaignsScreen } from "./CampaignsScreen";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const session = await auth();
  if (!canAccessMarketing(session)) redirect("/home");
  const [campaigns, options] = await Promise.all([listMarketingCampaigns({ money: canSeeMoney(session) }), marketingOptions()]);
  return <CampaignsScreen campaigns={campaigns} users={options.users} />;
}
