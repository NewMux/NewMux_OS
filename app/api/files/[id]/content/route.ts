import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { canAccessCompany } from "@/lib/rbac";
import { getFileBytes } from "@/lib/data/files";
import { NotFoundError } from "@/lib/data/sql";

/** Types a browser can safely show inline; everything else downloads. */
const INLINE = /^(image\/(png|jpe?g|gif|webp|heic|heif)|application\/pdf)$/;

/** The file's bytes. `?download=1` forces a download. */
export const GET = route<{ id: string }>({ allow: canAccessCompany }, async ({ req, params }) => {
  const found = await getFileBytes(params.id);
  if (!found) throw new NotFoundError("File");
  const { file, data } = found;
  const inline = INLINE.test(file.contentType) && req.nextUrl.searchParams.get("download") !== "1";
  const ascii = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": INLINE.test(file.contentType) ? file.contentType : "application/octet-stream",
      "Content-Length": String(data.byteLength),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
});
