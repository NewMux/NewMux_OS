import { route, body } from "@/lib/api";
import { countActivePartners, findUserById, updateUser } from "@/lib/data/users";
import { logAudit } from "@/lib/data/audit";
import { NotFoundError, ValidationError } from "@/lib/data/sql";
import { isPartnerAdmin } from "@/lib/rbac";
import { ROLE_LABEL } from "@/lib/data/types";
import { updateUserSchema } from "@/lib/validators/users";

/**
 * Settings → Team: rename someone, change their role, or turn their account
 * off (they're signed out within 5 minutes; nothing they made is deleted).
 * Nobody can change their own role or deactivate themselves, and the last
 * active partner can't be demoted or deactivated, so the app can't be left
 * without anyone who can manage it.
 */
export const PATCH = route<{ id: string }>({ allow: isPartnerAdmin }, async ({ req, params, session }) => {
  const patch = await body(req, updateUserSchema);
  const user = await findUserById(params.id);
  if (!user) throw new NotFoundError("Person");
  const self = user.id === session.user.id;
  if (self && ((patch.role && patch.role !== user.role) || patch.isActive === false)) throw new ValidationError("You can't change your own role or turn off your own account.");
  const losesPartner = user.role === "partner_admin" && user.isActive && ((patch.role && patch.role !== "partner_admin") || patch.isActive === false);
  if (losesPartner && (await countActivePartners()) <= 1) throw new ValidationError("NEWMUX OS needs at least one active partner.");

  await updateUser(user.id, patch);
  const changes = [
    patch.fullName && patch.fullName !== user.fullName ? `renamed to ${patch.fullName}` : null,
    patch.role && patch.role !== user.role ? `${ROLE_LABEL[user.role]} → ${ROLE_LABEL[patch.role]}` : null,
    patch.isActive !== undefined && patch.isActive !== user.isActive ? (patch.isActive ? "reactivated" : "deactivated") : null,
  ].filter(Boolean);
  if (changes.length) await logAudit({ entityType: "user", entityId: user.id, action: "update", summary: `${user.fullName}: ${changes.join(", ")}`, changedBy: session.user.id });
  return { ok: true };
});
