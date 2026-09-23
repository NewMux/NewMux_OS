"use client";

import { useState } from "react";
import { Pencil, Plus, Star } from "lucide-react";
import { Page } from "@/components/ui/Page";
import { Menu } from "@/components/ui/Menu";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ListRow, ListSection } from "@/components/ui/List";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { ContactActions } from "@/components/crm/ContactActions";
import { ActivityTimeline } from "@/components/crm/ActivityTimeline";
import { ClientSheet, ContactSheet, DealSheet, type ContactOption } from "@/components/crm/CrmSheets";
import { ActivityButtons, NewLinkedPageButton } from "@/components/crm/DealActions";
import type { Option } from "@/components/forms/Fields";
import { DEAL_STAGE, DOC_STATUS, DOC_TYPE, PROJECT_STATUS, CYCLE_LABEL } from "@/lib/labels";
import { centsToDisplay, convertMinorUnits } from "@/lib/money";
import { formatDate, relativeDay } from "@/lib/time";
import type { Client, HostingSubscription, KbPageSummary } from "@/lib/data/types";
import type { ActivityListItem, ContactListItem, DealListItem } from "@/lib/data/crm";
import type { ProjectWithStats } from "@/lib/data/projects";
import type { DocumentListItem } from "@/lib/data/documents";
import type { ExpenseListItem } from "@/lib/data/expenses";

type Tab = "overview" | "deals" | "work" | "money" | "wiki";

export function ClientDetail(props: {
  client: Client;
  contacts: ContactListItem[];
  deals: DealListItem[];
  projects: ProjectWithStats[];
  documents: DocumentListItem[];
  hosting: HostingSubscription[];
  activities: ActivityListItem[];
  pages: KbPageSummary[];
  expenses: ExpenseListItem[];
  options: { clients: Option[]; contacts: ContactOption[]; users: Option[] };
}) {
  const { client, contacts, deals, projects, documents, hosting, activities, pages, expenses, options } = props;
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactListItem | null>(null);
  const [addingDeal, setAddingDeal] = useState(false);
  const primary = contacts.find((c) => c.isPrimary) ?? contacts[0];

  const invoices = documents.filter((d) => d.type === "invoice" && d.status !== "archived" && d.status !== "draft");
  const billed = invoices.reduce((s, d) => s + convertMinorUnits(d.totalCents, d.currency, "BHD"), 0);
  const collected = invoices.reduce((s, d) => s + convertMinorUnits(d.paidCents, d.currency, "BHD"), 0);
  const spent = expenses.reduce((s, e) => s + convertMinorUnits(e.amountCents, e.currency, "BHD"), 0);

  return (
    <Page
      title={client.name}
      subtitle={[client.clientCode, client.industry].filter(Boolean).join(" · ") || undefined}
      back={{ href: "/clients", label: "Clients" }}
      actions={
        <Menu
          items={[
            { label: "Edit Client", icon: Pencil, onSelect: () => setEditing(true) },
            { label: "Add Contact", icon: Plus, onSelect: () => setAddingContact(true) },
            { label: "New Deal", icon: Plus, onSelect: () => setAddingDeal(true) },
          ]}
        />
      }
    >
      <div className="mx-auto max-w-2xl">
        <ContactActions phone={primary?.phone ?? client.phone} whatsapp={primary?.whatsapp} email={primary?.email ?? client.email} website={client.website} />

        <SegmentedControl
          className="mb-6"
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: "Info" },
            { value: "deals", label: "Deals" },
            { value: "work", label: "Work" },
            { value: "money", label: "Money" },
            { value: "wiki", label: "Wiki" },
          ]}
        />

        {tab === "overview" && (
          <>
            <ListSection header="People" action={<button className="text-subhead text-accent" onClick={() => setAddingContact(true)}>Add</button>}>
              {contacts.map((c) => (
                <ListRow
                  key={c.id}
                  onClick={() => setEditingContact(c)}
                  leading={<Avatar name={c.fullName} size={36} />}
                  title={
                    <span className="flex items-center gap-1.5">
                      {c.fullName}
                      {c.isPrimary && <Star className="h-3.5 w-3.5 fill-ios-yellow text-ios-yellow" />}
                    </span>
                  }
                  subtitle={[c.title, c.phone ?? c.email].filter(Boolean).join(" · ")}
                  chevron
                />
              ))}
              {contacts.length === 0 && <ListRow title="No contacts yet" onClick={() => setAddingContact(true)} />}
            </ListSection>
            {(client.phone || client.email || client.website || client.billingAddress) && (
              <ListSection header="Company">
                {client.phone && <ListRow title="Phone" detail={client.phone} />}
                {client.email && <ListRow title="Email" detail={client.email} />}
                {client.website && <ListRow title="Website" detail={client.website} />}
                {client.billingAddress && <ListRow title="Billing address" subtitle={client.billingAddress} multiline />}
              </ListSection>
            )}
            {client.notes && (
              <ListSection header="Notes">
                <p className="whitespace-pre-wrap px-4 py-3 text-body">{client.notes}</p>
              </ListSection>
            )}
            <ListSection header="Activity" action={<ActivityButtons link={{ clientId: client.id, contactId: primary?.id }} />}>
              <ActivityTimeline activities={activities} showContext />
            </ListSection>
          </>
        )}

        {tab === "deals" && (
          <ListSection action={<button className="text-subhead text-accent" onClick={() => setAddingDeal(true)}>New Deal</button>} header="Deals">
            {deals.map((d) => (
              <ListRow
                key={d.id}
                href={`/crm/deals/${d.id}`}
                title={d.title}
                subtitle={d.expectedClose ? `Close ${formatDate(d.expectedClose)}` : undefined}
                detail={centsToDisplay(d.valueCents, d.currency)}
                trailing={<Badge color={DEAL_STAGE[d.stage].color}>{DEAL_STAGE[d.stage].label}</Badge>}
              />
            ))}
            {deals.length === 0 && <ListRow title="No deals with this client yet" />}
          </ListSection>
        )}

        {tab === "work" && (
          <ListSection header="Projects">
            {projects.map((p) => (
              <ListRow
                key={p.id}
                href={`/projects/${p.id}`}
                leading={<ProgressRing value={p.taskCount ? p.doneCount / p.taskCount : 0} size={30} />}
                title={p.name}
                subtitle={`${p.openCount} open tasks${p.overdueCount ? ` · ${p.overdueCount} overdue` : ""}`}
                trailing={<Badge color={PROJECT_STATUS[p.status].color}>{PROJECT_STATUS[p.status].label}</Badge>}
              />
            ))}
            {projects.length === 0 && <ListRow title="No projects yet" />}
          </ListSection>
        )}

        {tab === "money" && (
          <>
            <div className="mb-6 grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Billed", value: billed },
                { label: "Collected", value: collected },
                { label: "Costs", value: spent },
              ].map((m) => (
                <div key={m.label} className="rounded-[18px] bg-bg-elevated px-3 py-3">
                  <div className="text-caption1 text-label-2">{m.label}</div>
                  <div className="font-rounded text-headline tabular">{centsToDisplay(m.value, "BHD")}</div>
                </div>
              ))}
            </div>
            <ListSection header="Invoices & Quotes" action={<a href={`/documents/new?type=invoice&clientId=${client.id}`} className="text-subhead text-accent">New Invoice</a>}>
              {documents.map((d) => (
                <ListRow
                  key={d.id}
                  href={`/documents/${d.id}`}
                  title={d.documentNumber}
                  subtitle={`${DOC_TYPE[d.type]} · ${formatDate(d.issuedAt ?? d.createdAt)}`}
                  detail={centsToDisplay(d.totalCents, d.currency)}
                  trailing={<Badge color={DOC_STATUS[d.status].color}>{DOC_STATUS[d.status].label}</Badge>}
                />
              ))}
              {documents.length === 0 && <ListRow title="No documents yet" />}
            </ListSection>
            <ListSection header="Hosting Fees">
              {hosting.map((h) => (
                <ListRow
                  key={h.id}
                  href="/hosting"
                  title={h.label ?? h.item}
                  subtitle={`${CYCLE_LABEL[h.cycle]} · next ${h.nextDueDate ? relativeDay(h.nextDueDate) : "—"}`}
                  detail={centsToDisplay(h.amountCents, h.currency)}
                />
              ))}
              {hosting.length === 0 && <ListRow title="No hosting fees" />}
            </ListSection>
          </>
        )}

        {tab === "wiki" && (
          <ListSection header="Linked Pages">
            {pages.map((p) => (
              <ListRow key={p.id} href={`/wiki/${p.id}`} leading={<span className="text-[20px]">{p.emoji ?? "📄"}</span>} title={p.title || "Untitled"} subtitle={p.spaceName} />
            ))}
            <NewLinkedPageButton link={{ clientId: client.id }} title={`${client.name} — account notes`} />
          </ListSection>
        )}
      </div>

      <ClientSheet client={client} open={editing} onOpenChange={setEditing} />
      <ContactSheet open={addingContact} onOpenChange={setAddingContact} clients={options.clients} defaultClientId={client.id} />
      <ContactSheet contact={editingContact ?? undefined} open={!!editingContact} onOpenChange={(o) => !o && setEditingContact(null)} clients={options.clients} />
      <DealSheet open={addingDeal} onOpenChange={setAddingDeal} clients={options.clients} contacts={options.contacts} users={options.users} defaults={{ clientId: client.id }} />
    </Page>
  );
}
