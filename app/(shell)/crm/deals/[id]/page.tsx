import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessCrm } from "@/lib/rbac";
import { getDealById, listActivities, listContacts } from "@/lib/data/crm";
import { listDocuments } from "@/lib/data/documents";
import { listClients } from "@/lib/data/clients";
import { listUsers } from "@/lib/data/users";
import { listLinkedPages } from "@/lib/data/kb";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection } from "@/components/ui/List";
import { Badge } from "@/components/ui/Badge";
import { ActivityTimeline } from "@/components/crm/ActivityTimeline";
import { DealHeaderActions, DealMenu, ActivityButtons, NewLinkedPageButton } from "@/components/crm/DealActions";
import { DEAL_STAGE, DOC_STATUS, DOC_TYPE } from "@/lib/labels";
import { centsToDisplay } from "@/lib/money";
import { formatDate } from "@/lib/time";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canAccessCrm(session)) redirect("/home");
  const { id } = await params;
  const deal = await getDealById(id);
  if (!deal) notFound();
  const [activities, documents, pages, clients, contacts, users] = await Promise.all([
    listActivities({ dealId: id }),
    listDocuments({ dealId: id }),
    listLinkedPages({ dealId: id }),
    listClients(),
    listContacts(),
    listUsers(),
  ]);
  const stage = DEAL_STAGE[deal.stage];

  return (
    <Page
      title={deal.title}
      back={{ href: "/crm/pipeline", label: "Pipeline" }}
      actions={
        <DealMenu
          deal={deal}
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          contacts={contacts.map((c) => ({ id: c.id, name: c.fullName, clientId: c.clientId }))}
          users={users.map((u) => ({ id: u.id, name: u.fullName }))}
        />
      }
    >
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 rounded-[20px] bg-bg-elevated p-5 shadow-widget dark:shadow-none">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-subhead text-label-2">{deal.clientName ?? deal.contactName ?? "New prospect"}</div>
              <div className="font-rounded text-[34px] font-semibold leading-tight tabular">{centsToDisplay(deal.valueCents, deal.currency)}</div>
            </div>
            <Badge color={stage.color}>{stage.label}</Badge>
          </div>
          <DealHeaderActions deal={deal} />
        </div>

        {deal.stage === "lost" && deal.lostReason && (
          <ListSection header="Lost because">
            <p className="px-4 py-3 text-body">{deal.lostReason}</p>
          </ListSection>
        )}

        <ListSection header="Details">
          {deal.clientId && <ListRow title="Client" detail={deal.clientName} href={`/clients/${deal.clientId}`} />}
          {deal.contactId && <ListRow title="Contact" detail={deal.contactName} href={`/contacts/${deal.contactId}`} />}
          <ListRow title="Owner" detail={deal.ownerName ?? "Unassigned"} />
          <ListRow title="Expected close" detail={formatDate(deal.expectedClose)} />
          <ListRow title="Probability" detail={`${deal.probability}%`} />
          {deal.source && <ListRow title="Source" detail={deal.source} />}
          <ListRow title="Created" detail={formatDate(deal.createdAt)} />
        </ListSection>

        {deal.notes && (
          <ListSection header="Notes">
            <p className="whitespace-pre-wrap px-4 py-3 text-body">{deal.notes}</p>
          </ListSection>
        )}

        <ListSection header="Activity" action={<ActivityButtons link={{ dealId: deal.id, clientId: deal.clientId, contactId: deal.contactId }} />}>
          <ActivityTimeline activities={activities} />
        </ListSection>

        <ListSection header="Quotes & Invoices">
          {documents.map((d) => (
            <ListRow
              key={d.id}
              href={`/documents/${d.id}`}
              title={d.documentNumber}
              subtitle={DOC_TYPE[d.type]}
              detail={centsToDisplay(d.totalCents, d.currency)}
              trailing={<Badge color={DOC_STATUS[d.status].color}>{DOC_STATUS[d.status].label}</Badge>}
            />
          ))}
          <ListRow href={`/documents/new?type=quote&dealId=${deal.id}`} title={<span className="text-accent">New Quote from Deal</span>} chevron={false} />
        </ListSection>

        <ListSection header="Wiki">
          {pages.map((p) => (
            <ListRow key={p.id} href={`/wiki/${p.id}`} leading={<span className="text-[20px]">{p.emoji ?? "📄"}</span>} title={p.title || "Untitled"} subtitle={p.spaceName} />
          ))}
          <NewLinkedPageButton link={{ dealId: deal.id, clientId: deal.clientId }} title={`${deal.title} — notes`} />
        </ListSection>
      </div>
    </Page>
  );
}
