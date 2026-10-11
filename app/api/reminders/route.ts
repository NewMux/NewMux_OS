import { route, body } from "@/lib/api";
import { createReminder, listUpcomingReminders } from "@/lib/data/notifications";
import { findUserById } from "@/lib/data/users";
import { ValidationError } from "@/lib/data/sql";
import { isPartnerAdmin } from "@/lib/rbac";
import { reminderSchema } from "@/lib/validators/notifications";

/** Reminders that haven't gone yet, for you or set by you. */
export const GET = route({}, async ({ session }) => ({ reminders: await listUpcomingReminders(session.user.id) }));

/** A push notification at a set time. For yourself, or (partners) for a teammate. */
export const POST = route({ status: 201 }, async ({ req, session }) => {
  const { userId, ...input } = await body(req, reminderSchema);
  const forUser = userId ?? session.user.id;
  if (forUser !== session.user.id) {
    if (!isPartnerAdmin(session)) throw new ValidationError("You can only set reminders for yourself.");
    if (!(await findUserById(forUser))?.isActive) throw new ValidationError("That person has no active account.");
  }
  return { reminder: await createReminder({ ...input, userId: forUser, createdBy: session.user.id }) };
});
