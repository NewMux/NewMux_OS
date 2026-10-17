import { route } from "@/lib/api";
import { canAccessDocuments } from "@/lib/rbac";
import { officialPdfData } from "@/lib/data/officialDocs";
import { ValidationError } from "@/lib/data/sql";

/**
 * A document's content for its PDF, in the official design. The browser
 * renders it (lib/pdf/download.tsx): Workers can't run @react-pdf's layout
 * engine. statement=1: an invoice with the payments received so far.
 */
export const GET = route({ allow: canAccessDocuments }, async ({ req }) => {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) throw new ValidationError("Which document?");
  return officialPdfData(id, { statement: req.nextUrl.searchParams.get("statement") === "1" });
});
