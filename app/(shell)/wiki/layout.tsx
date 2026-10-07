import { BookOpen } from "lucide-react";
import { auth } from "@/lib/auth";
import { listFavorites, listRecentPages, listRecentlyUpdatedPages, listSpaces, listTemplates } from "@/lib/data/kb";
import { isPartnerAdmin } from "@/lib/rbac";
import { SplitView } from "@/components/shell/SplitView";
import { EmptyState } from "@/components/ui/EmptyState";
import { WikiHome } from "./WikiHome";

/** Notes-style: spaces, favorites and recent pages beside the open page on iPad/Mac. */
export default async function WikiLayout({ children }: { children: React.ReactNode }) {
  const session = (await auth())!;
  const [spaces, templates, favorites, recents, updated] = await Promise.all([
    listSpaces(),
    listTemplates(),
    listFavorites(session.user.id),
    listRecentPages(session.user.id, 6),
    listRecentlyUpdatedPages(8),
  ]);
  return (
    <SplitView
      list={<WikiHome spaces={spaces} templates={templates} favorites={favorites} recents={recents} updated={updated} canDelete={isPartnerAdmin(session)} />}
      placeholder={<EmptyState icon={BookOpen} title="No page selected" message="Choose a page, or start a new one with +." />}
    >
      {children}
    </SplitView>
  );
}
