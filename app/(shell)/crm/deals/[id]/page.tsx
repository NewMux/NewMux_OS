import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessCrm, canSeeMoney } from "@/lib/rbac";
import { getDealById, listActivities, listContacts, withoutValue } from "@/lib/data/crm";
import { listCampaigns } from "@/lib/data/campaigns";
import { listDocuments } from "@/lib/data/documents";
import { listClients } from "@/lib/data/clients";
import { listUsers } from "@/lib/data/users";
import { listLinkedPages } from "@/lib/data/kb";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection } from "@/components/ui/List";
import { Badge } from "@/components/ui/Badge";
import { ActivityTimeline } from "@/components/crm/ActivityTimeline";
import { DealHeaderActions, DealMenu, ActivityButtons } from "@/components/crm/DealActions";
import { DOC_TYPE } from "@/lib/labels";
import { centsToDisplay } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { docBadge } from "@/components/documents/docStatus";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canAccessCrm(session)) redirect("/home");
  const { id } = await params;
  const money = canSeeMoney(session);
  const found = await getDealById(id);
  if (!found) notFound();
  const deal = money ? found : withoutValue(found);
  const [activities, documents, pages, clients, contacts, users, campaigns] = await Promise.all([
    listActivities({ dealId: id }),
    money ? listDocuments({ dealId: id }) : Promise.resolve([]),
    listLinkedPages({ dealId: id }),
    listClients(),
    listContacts(),
    listUsers(),
    listCampaigns(),
  ]);
  const campaign = campaigns.find((c) => c.id === deal.campaignId);

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
          campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
        />
      }
    >
      <div className="mx-auto max-w-2xl">
        <div className="mb-7 rounded-card bg-bg-elevated p-4">
          <div className="truncate text-subhead text-label-2">{deal.clientName ?? deal.contactName ?? "New prospect"}</div>
          {money ? (
            <div className="font-rounded text-title1 font-semibold leading-tight tabular">{centsToDisplay(deal.valueCents, deal.currency)}</div>
          ) : (
            <div className="text-title2 font-semibold leading-tight">{deal.title}</div>
          )}
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
          {campaign && <ListRow title="Campaign" detail={campaign.name} href={`/marketing/campaigns?id=${campaign.id}`} />}
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

        {documents.length > 0 && (
          <ListSection header="Quotes & Invoices">
            {documents.map((d) => (
              <ListRow
                key={d.id}
                href={`/documents/${d.id}`}
                title={d.documentNumber}
                subtitle={DOC_TYPE[d.type]}
                detail={centsToDisplay(d.totalCents, d.currency)}
                trailing={<Badge color={docBadge(d).color}>{docBadge(d).label}</Badge>}
              />
            ))}
          </ListSection>
        )}

        {pages.length > 0 && (
          <ListSection header="Wiki">
            {pages.map((p) => (
              <ListRow key={p.id} href={`/wiki/${p.id}`} leading={<span className="text-[20px]">{p.emoji ?? "📄"}</span>} title={p.title || "Untitled"} subtitle={p.spaceName} />
            ))}
          </ListSection>
        )}
      </div>
    </Page>
  );
}
