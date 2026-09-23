"use client";

import { useState } from "react";
import { Page } from "@/components/ui/Page";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ListRow, ListSection } from "@/components/ui/List";
import { ContactActions } from "@/components/crm/ContactActions";
import { ActivityTimeline } from "@/components/crm/ActivityTimeline";
import { ContactSheet } from "@/components/crm/CrmSheets";
import { ActivityButtons } from "@/components/crm/DealActions";
import type { Option } from "@/components/forms/Fields";
import { DEAL_STAGE } from "@/lib/labels";
import { centsToDisplay } from "@/lib/money";
import type { ActivityListItem, ContactListItem, DealListItem } from "@/lib/data/crm";

export function ContactDetail({ contact, activities, deals, clients }: { contact: ContactListItem; activities: ActivityListItem[]; deals: DealListItem[]; clients: Option[] }) {
  const [editing, setEditing] = useState(false);
  return (
    <Page
      title={contact.fullName}
      back={{ href: "/contacts", label: "Contacts" }}
      actions={
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 flex flex-col items-center text-center">
          <Avatar name={contact.fullName} size={96} />
          <div className="mt-3 text-subhead text-label-2">{[contact.title, contact.clientName].filter(Boolean).join(" · ")}</div>
        </div>
        <ContactActions phone={contact.phone} whatsapp={contact.whatsapp} email={contact.email} />
        <ListSection>
          {contact.phone && <ListRow title={<span className="text-footnote text-label-2">phone</span>} subtitle={<a href={`tel:${contact.phone}`} className="text-body text-accent">{contact.phone}</a>} />}
          {contact.whatsapp && <ListRow title={<span className="text-footnote text-label-2">whatsapp</span>} subtitle={<span className="text-body text-accent">{contact.whatsapp}</span>} />}
          {contact.email && <ListRow title={<span className="text-footnote text-label-2">email</span>} subtitle={<a href={`mailto:${contact.email}`} className="text-body text-accent">{contact.email}</a>} />}
          {contact.clientId && <ListRow title={<span className="text-footnote text-label-2">company</span>} subtitle={<span className="text-body text-label">{contact.clientName}</span>} href={`/clients/${contact.clientId}`} />}
          {!contact.phone && !contact.email && !contact.clientId && <ListRow title="No details yet" onClick={() => setEditing(true)} />}
        </ListSection>
        {contact.notes && (
          <ListSection header="Notes">
            <p className="whitespace-pre-wrap px-4 py-3 text-body">{contact.notes}</p>
          </ListSection>
        )}
        {deals.length > 0 && (
          <ListSection header="Deals">
            {deals.map((d) => (
              <ListRow key={d.id} href={`/crm/deals/${d.id}`} title={d.title} detail={centsToDisplay(d.valueCents, d.currency)} trailing={<Badge color={DEAL_STAGE[d.stage].color}>{DEAL_STAGE[d.stage].label}</Badge>} />
            ))}
          </ListSection>
        )}
        <ListSection header="Activity" action={<ActivityButtons link={{ contactId: contact.id, clientId: contact.clientId }} />}>
          <ActivityTimeline activities={activities} showContext />
        </ListSection>
      </div>
      <ContactSheet contact={contact} open={editing} onOpenChange={setEditing} clients={clients} />
    </Page>
  );
}
