import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { isPartnerAdmin } from "@/lib/rbac";
import { getSpaceById, listPagesInSpace, listSpaces, listTemplates } from "@/lib/data/kb";
import { SpaceScreen } from "./SpaceScreen";

export default async function SpacePage({ params }: { params: Promise<{ id: string }> }) {
  const session = (await auth())!;
  const { id } = await params;
  const space = await getSpaceById(id);
  if (!space) notFound();
  const [pages, spaces, templates] = await Promise.all([listPagesInSpace(id), listSpaces(), listTemplates()]);
  return <SpaceScreen space={space} pages={pages} spaces={spaces} templates={templates} canDelete={isPartnerAdmin(session)} />;
}
