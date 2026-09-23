import { auth } from "@/lib/auth";
import { listFavorites, listRecentPages, listRecentlyUpdatedPages, listSpaces, listTemplates } from "@/lib/data/kb";
import { isPartnerAdmin } from "@/lib/rbac";
import { WikiHome } from "./WikiHome";

export const metadata = { title: "Wiki" };

export default async function WikiPage() {
  const session = (await auth())!;
  const [spaces, templates, favorites, recents, updated] = await Promise.all([
    listSpaces(),
    listTemplates(),
    listFavorites(session.user.id),
    listRecentPages(session.user.id, 6),
    listRecentlyUpdatedPages(8),
  ]);
  return <WikiHome spaces={spaces} templates={templates} favorites={favorites} recents={recents} updated={updated} canDelete={isPartnerAdmin(session)} />;
}
