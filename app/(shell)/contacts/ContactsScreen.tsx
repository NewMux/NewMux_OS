"use client";

import { useMemo, useState } from "react";
import { Contact as ContactIcon, Plus } from "lucide-react";
import { Page, NavButton } from "@/components/ui/Page";
import { SearchField } from "@/components/ui/SearchField";
import { ListRow, ListSection } from "@/components/ui/List";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ContactSheet } from "@/components/crm/CrmSheets";
import type { Option } from "@/components/forms/Fields";
import { useNewParam } from "@/lib/hooks/useNewParam";
import type { ContactListItem } from "@/lib/data/crm";

/** Contacts-app style: alphabetical sections with a letter index on the edge. */
export function ContactsScreen({ contacts, clients }: { contacts: ContactListItem[]; clients: Option[] }) {
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  useNewParam(() => setCreating(true));

  const sections = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = [...contacts]
      .filter((c) => !term || [c.fullName, c.clientName, c.email, c.phone, c.title].some((v) => v?.toLowerCase().includes(term)))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
    const map = new Map<string, ContactListItem[]>();
    for (const c of list) {
      const letter = /[a-z]/i.test(c.fullName[0] ?? "") ? c.fullName[0]!.toUpperCase() : "#";
      map.set(letter, [...(map.get(letter) ?? []), c]);
    }
    return [...map.entries()];
  }, [contacts, q]);

  return (
    <Page
      title="Contacts"
      back={{ href: "/crm", label: "CRM" }}
      actions={
        <NavButton label="New contact" onClick={() => setCreating(true)}>
          <Plus className="h-5 w-5" />
        </NavButton>
      }
      accessory={<SearchField value={q} onChange={setQ} placeholder="Search" />}
    >
      {sections.length === 0 && <EmptyState icon={ContactIcon} title={q ? "No matches" : "No contacts"} message={q ? undefined : "Add the people you work with at each client."} />}
      <div className="relative pr-5 md:pr-0">
        {sections.map(([letter, items]) => (
          <ListSection key={letter} header={letter} className="scroll-mt-16">
            <span id={`letter-${letter}`} className="block -translate-y-16" aria-hidden />
            {items.map((c) => (
              <ListRow
                key={c.id}
                href={`/contacts/${c.id}`}
                leading={<Avatar name={c.fullName} size={36} />}
                title={c.fullName}
                subtitle={[c.title, c.clientName].filter(Boolean).join(" · ") || undefined}
              />
            ))}
          </ListSection>
        ))}
        {sections.length > 4 && (
          <nav aria-label="Index" className="fixed right-1 top-1/2 z-20 flex -translate-y-1/2 flex-col md:hidden">
            {sections.map(([letter]) => (
              <a key={letter} href={`#letter-${letter}`} className="px-1 text-center text-[11px] font-semibold leading-[15px] text-accent">
                {letter}
              </a>
            ))}
          </nav>
        )}
      </div>
      <ContactSheet open={creating} onOpenChange={setCreating} clients={clients} />
    </Page>
  );
}
