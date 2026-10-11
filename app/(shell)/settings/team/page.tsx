import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { isPartnerAdmin } from "@/lib/rbac";
import { listTeam } from "@/lib/data/users";
import { TeamScreen } from "@/components/settings/TeamScreen";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const session = (await auth())!;
  if (!isPartnerAdmin(session)) notFound();
  return <TeamScreen meId={session.user.id} team={await listTeam()} />;
}
