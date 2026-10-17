import { auth } from "@/lib/auth";
import { isPartnerAdmin } from "@/lib/rbac";
import { githubConfigured, githubRepo } from "@/lib/github";
import { OsUpdatesScreen } from "@/components/settings/OsUpdatesScreen";

export const metadata = { title: "OS Updates" };

/** Settings → OS Updates: changes to NEWMUX OS itself, built by Claude Code on GitHub (lib/osChanges.ts). Everyone can ask; partners merge. */
export default async function OsUpdatesPage() {
  const session = (await auth())!;
  return <OsUpdatesScreen meId={session.user.id} partner={isPartnerAdmin(session)} configured={githubConfigured()} repo={githubRepo()} />;
}
