import { route } from "@/lib/api";
import { canAccessDocuments } from "@/lib/rbac";
import { convertToContract } from "@/lib/data/officialDocs";

/** An accepted quote or proposal becomes a draft contract with the same content. */
export const POST = route<{ id: string }>({ allow: canAccessDocuments, status: 201 }, async ({ params, session }) => ({
  document: await convertToContract(params.id, session.user.id),
}));
