import bcrypt from "bcryptjs";
import { z } from "zod";
import { route, body } from "@/lib/api";
import { findUserById, updatePasswordHash } from "@/lib/data/users";
import { ValidationError } from "@/lib/data/sql";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10, "Use at least 10 characters"),
});

export const POST = route({}, async ({ req, session }) => {
  const { currentPassword, newPassword } = await body(req, schema);
  const user = await findUserById(session.user.id);
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new ValidationError("Your current password is incorrect.");
  }
  await updatePasswordHash(user.id, await bcrypt.hash(newPassword, 12));
  return { ok: true };
});
