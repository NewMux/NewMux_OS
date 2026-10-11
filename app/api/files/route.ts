import { route } from "@/lib/api";
import { canAccessCompany, canSeeMoney } from "@/lib/rbac";
import { fileMetaSchema } from "@/lib/validators/files";
import { createFile, fileCategoriesFor, listFiles } from "@/lib/data/files";
import { ValidationError } from "@/lib/data/sql";

export const GET = route({ allow: canAccessCompany }, async ({ req, session }) => ({
  files: await listFiles({ includeReceipts: req.nextUrl.searchParams.get("receipts") === "1", categories: canSeeMoney(session) ? undefined : fileCategoriesFor(false) }),
}));

/** multipart/form-data: `file` plus the metadata fields (item 18; receipts for item 38). */
export const POST = route({ allow: canAccessCompany, status: 201 }, async ({ req, session }) => {
  const form = await req.formData().catch(() => null);
  const upload = form?.get("file");
  if (!form || !(upload instanceof Blob)) throw new ValidationError("Choose a file to upload.");
  const fields = Object.fromEntries([...form.entries()].filter(([k, v]) => k !== "file" && typeof v === "string"));
  const meta = fileMetaSchema.parse({ name: (upload as File).name || "Upload", ...fields });
  if (!fileCategoriesFor(canSeeMoney(session)).includes(meta.category)) throw new ValidationError("That category is for partners only.");
  const data = Buffer.from(await upload.arrayBuffer());
  return { file: await createFile(meta, { contentType: upload.type, data }, session.user.id) };
});
