import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessCrm } from "@/lib/rbac";
import { listActivities, listOpenFollowUps } from "@/lib/data/crm";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection } from "@/components/ui/List";
import { FollowUpRow } from "@/components/crm/FollowUpRow";
import { ActivityTimeline } from "@/components/crm/ActivityTimeline";
import { ActivityButtons } from "@/components/crm/DealActions";

export const metadata = { title: "Activity" };

export default async function ActivitiesPage() {
  const session = await auth();
  if (!canAccessCrm(session)) redirect("/home");
  const [followUps, activities] = await Promise.all([listOpenFollowUps(), listActivities({ limit: 150 })]);
  return (
    <Page title="Activity" back={{ href: "/crm", label: "CRM" }}>
      <div className="mx-auto max-w-2xl">
        <ListSection header="Follow-ups" action={<ActivityButtons link={{}} />}>
          {followUps.map((a) => (
            <FollowUpRow key={a.id} activity={a} />
          ))}
          {followUps.length === 0 && <ListRow title="You're all caught up" />}
        </ListSection>
        <ListSection header="Timeline">
          <ActivityTimeline activities={activities.filter((a) => a.kind !== "follow_up" || a.completedAt)} showContext />
        </ListSection>
      </div>
    </Page>
  );
}
