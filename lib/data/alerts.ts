import { store } from "./store";
import { hostingAlertLevel } from "./hosting";
import type { Meeting, Task, HostingSubscription, Project } from "./types";

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export type DashboardAlerts = {
  todaysMeetings: Meeting[];
  tasksDueTodayOrOverdue: (Task & { overdue: boolean })[];
  renewalsWithin30Days: { label: string; dueDate: string; overdue: boolean }[];
  hostingAlerts: { subscription: HostingSubscription; overdue: boolean }[];
  activeProjectCount: number;
  completedProjectCount: number;
};

export async function getDashboardAlerts(): Promise<DashboardAlerts> {
  const now = new Date();

  const todaysMeetings = store.meetings.filter((m) => isSameDay(new Date(m.startsAt), now));

  const tasksDueTodayOrOverdue = store.tasks
    .filter((t) => t.status !== "done" && t.dueAt)
    .filter((t) => new Date(t.dueAt!).getTime() <= now.getTime() || isSameDay(new Date(t.dueAt!), now))
    .map((t) => ({ ...t, overdue: new Date(t.dueAt!).getTime() < now.getTime() && !isSameDay(new Date(t.dueAt!), now) }));

  const cutoff30 = now.getTime() + 30 * 24 * 60 * 60 * 1000;
  const renewalsWithin30Days: DashboardAlerts["renewalsWithin30Days"] = [];
  for (const project of store.projects as Project[]) {
    if (project.domainRenewalDate && new Date(project.domainRenewalDate).getTime() <= cutoff30) {
      renewalsWithin30Days.push({
        label: `${project.name} — domain renewal`,
        dueDate: project.domainRenewalDate,
        overdue: new Date(project.domainRenewalDate).getTime() < now.getTime(),
      });
    }
  }
  if (store.companyProfile?.crRenewalDate && new Date(store.companyProfile.crRenewalDate).getTime() <= cutoff30) {
    renewalsWithin30Days.push({
      label: "Commercial Registration renewal",
      dueDate: store.companyProfile.crRenewalDate,
      overdue: new Date(store.companyProfile.crRenewalDate).getTime() < now.getTime(),
    });
  }
  if (store.companyProfile?.mainDomainRenewalDate && new Date(store.companyProfile.mainDomainRenewalDate).getTime() <= cutoff30) {
    renewalsWithin30Days.push({
      label: `${store.companyProfile.mainDomain} renewal`,
      dueDate: store.companyProfile.mainDomainRenewalDate,
      overdue: new Date(store.companyProfile.mainDomainRenewalDate).getTime() < now.getTime(),
    });
  }
  for (const cert of store.companyProfile?.certifications ?? []) {
    if (cert.expiryDate && new Date(cert.expiryDate).getTime() <= cutoff30) {
      renewalsWithin30Days.push({
        label: `${cert.name} expiry`,
        dueDate: cert.expiryDate,
        overdue: new Date(cert.expiryDate).getTime() < now.getTime(),
      });
    }
  }

  const hostingAlerts = store.hostingSubscriptions
    .map((subscription) => ({ subscription, level: hostingAlertLevel(subscription) }))
    .filter((x) => x.level !== "ok")
    .map((x) => ({ subscription: x.subscription, overdue: x.level === "overdue" }));

  const activeProjectCount = store.projects.filter((p) => p.status === "active_sprint").length;
  const completedProjectCount = store.projects.filter((p) => p.status === "completed").length;

  return {
    todaysMeetings,
    tasksDueTodayOrOverdue,
    renewalsWithin30Days,
    hostingAlerts,
    activeProjectCount,
    completedProjectCount,
  };
}
