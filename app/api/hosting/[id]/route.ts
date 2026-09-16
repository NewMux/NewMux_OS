import { crudRoute } from "@/lib/api/crudRoute";
import { canAccessFinance } from "@/lib/rbac";
import { updateHostingSubscriptionSchema } from "@/lib/validators/hosting";
import {
  updateHostingSubscription,
  deleteHostingSubscription,
  getHostingSubscriptionById,
} from "@/lib/data/hosting";
import { majorToMinorUnits } from "@/lib/money";

export const { PATCH, DELETE } = crudRoute({
  kind: "hosting",
  label: "hosting subscription",
  schema: updateHostingSubscriptionSchema,
  can: canAccessFinance,
  load: async (id) => {
    const sub = await getHostingSubscriptionById(id);
    return sub && { name: `This ${sub.item} subscription` };
  },
  update: async (id, patch) => {
    const { amount, ...rest } = patch;
    const existing = await getHostingSubscriptionById(id);
    return updateHostingSubscription(id, {
      ...rest,
      ...(amount !== undefined
        ? {
            amountCents: majorToMinorUnits(
              amount,
              patch.currency ?? existing?.currency ?? "BHD",
            ),
          }
        : {}),
    });
  },
  remove: (id) => deleteHostingSubscription(id),
});
