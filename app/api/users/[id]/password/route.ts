import bcrypt from "bcryptjs";
import { z } from "zod";
import { route, body } from "@/lib/api";
import { findUserById, updatePasswordHash } from "@/lib/data/users";
import { logAudit } from "@/lib/data/audit";
import { NotFoundError, ValidationError } from "@/lib/data/sql";
import { isPartnerAdmin } from "@/lib/rbac";

const schema = z.object({ newPassword: z.string().min(10, "Use at least 10 characters") });

/**
 * A partner sets a new password for someone else who can't sign in.
 * Your own password is changed under Settings → Account, which asks for the
 * current one. The reset is recorded in the audit log, never the password.
 */
export const POST = route<{ id: string }>({ allow: isPartnerAdmin }, async ({ req, session, params }) => {
  const { newPassword } = await body(req, schema);
  if (params.id === session.user.id) throw new ValidationError("Change your own password under Settings → Account.");
  const user = await findUserById(params.id);
  if (!user) throw new NotFoundError("That person no longer has an account.");
  await updatePasswordHash(user.id, await bcrypt.hash(newPassword, 12));
  await logAudit({ entityType: "user", entityId: user.id, action: "update", summary: `Password reset for ${user.fullName}`, changedBy: session.user.id });
  return { ok: true };
});
