import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { forRole, phoneTabs, sidebarFor, tabChoices, COMPANY_LINKS } from "@/lib/nav";
import { MoreScreen } from "./MoreScreen";

export const metadata = { title: "More" };

/** The phone's More tab: every section that isn't in the tab bar, and Edit to choose which are. */
export default async function MorePage() {
  const session = (await auth())!;
  const role = session.user.role;
  const tabs = phoneTabs(role, (await cookies()).get("tabs")?.value);
  const inBar = new Set(tabs.map((t) => t.href));
  // Each section with its pages, as on the iPad sidebar, minus what the tab bar already holds.
  const sections = sidebarFor(role).filter((s) => !inBar.has(s.href));
  const sidebarHrefs = new Set(sidebarFor(role).flatMap((s) => [s.href, ...(s.children ?? []).map((c) => c.href)]));
  const extras = forRole(COMPANY_LINKS, role).filter((l) => !sidebarHrefs.has(l.href));
  return (
    <MoreScreen
      user={{ name: session.user.name ?? session.user.email ?? "You", email: session.user.email ?? "", role }}
      sections={sections}
      extras={extras}
      choices={tabChoices(role)}
      chosen={tabs.slice(1, -1).map((t) => t.href)}
    />
  );
}
