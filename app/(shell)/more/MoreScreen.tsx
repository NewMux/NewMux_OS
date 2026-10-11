"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Sparkles } from "lucide-react";
import { Page, NavButton } from "@/components/ui/Page";
import { Avatar } from "@/components/ui/Avatar";
import { IconTile, ListRow, ListSection } from "@/components/ui/List";
import { CheckCircle } from "@/components/ui/Toggle";
import { FormSheet } from "@/components/ui/FormSheet";
import { NavIcon } from "@/components/shell/NavIcon";
import { openHaman } from "@/components/haman/HamanSheet";
import { CHOSEN_TABS, type NavLink, type NavSection } from "@/lib/nav";
import { ROLE_LABEL, type UserRole } from "@/lib/data/types";

const tile = (l: NavLink) => <IconTile icon={({ className }) => <NavIcon icon={l.icon} className={className} />} color={l.color} />;

/**
 * iOS's More tab: the sections that don't fit in the tab bar, each opening
 * its pages, and Edit to choose the tab bar's sections.
 */
export function MoreScreen({
  user,
  sections,
  extras,
  choices,
  chosen,
}: {
  user: { name: string; email: string; role: UserRole };
  sections: NavSection[];
  extras: NavLink[];
  choices: NavLink[];
  chosen: string[];
}) {
  const [editing, setEditing] = useState(false);
  return (
    <Page
      title="More"
      actions={
        <NavButton label="Edit tabs" onClick={() => setEditing(true)}>
          <span className="px-1 text-body font-medium text-accent">Edit</span>
        </NavButton>
      }
    >
      <div className="mx-auto max-w-2xl">
        <ListSection>
          <ListRow href="/settings" leading={<Avatar name={user.name} size={52} />} title={<span className="text-headline">{user.name}</span>} subtitle={`${ROLE_LABEL[user.role]} · ${user.email}`} />
        </ListSection>

        {sections.map((s) =>
          s.children?.length ? (
            <ListSection key={s.href} header={s.label}>
              {s.children.map((c) => (
                <ListRow key={c.href} href={c.href} leading={tile(c)} title={c.label === "Overview" ? s.label : c.label} />
              ))}
            </ListSection>
          ) : null,
        )}

        <ListSection>
          {sections
            .filter((s) => !s.children?.length)
            .map((s) => (
              <ListRow key={s.href} href={s.href} leading={tile(s)} title={s.label} />
            ))}
          {extras.map((l) => (
            <ListRow key={l.href} href={l.href} leading={tile(l)} title={l.label} />
          ))}
          <ListRow leading={<IconTile icon={Sparkles} color="blue" />} title="Ask Haman" onClick={() => openHaman()} chevron />
          <ListRow href="/settings" leading={<IconTile icon={Settings} color="gray" />} title="Settings" />
        </ListSection>
      </div>
      <EditTabsSheet open={editing} onOpenChange={setEditing} choices={choices} chosen={chosen} />
    </Page>
  );
}

/** Pick the tab bar's sections, in the order tapped (Today is always first, More always last). */
function EditTabsSheet({ open, onOpenChange, choices, chosen }: { open: boolean; onOpenChange: (o: boolean) => void; choices: NavLink[]; chosen: string[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(chosen);
  useEffect(() => {
    if (open) setPicked(chosen);
  }, [open, chosen]);
  const max = Math.min(CHOSEN_TABS, choices.length);
  const toggle = (href: string) => setPicked((p) => (p.includes(href) ? p.filter((h) => h !== href) : p.length < max ? [...p, href] : [...p.slice(1), href]));
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Tab Bar"
      submitLabel="Done"
      size="auto"
      canSubmit={picked.length > 0}
      onSubmit={async () => {
        document.cookie = `tabs=${picked.join(",")}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
        return true;
      }}
    >
      <ListSection footer={`Choose up to ${max}. Today is always first and More always last; everything else is under More.`}>
        <ListRow leading={tile({ href: "/home", label: "Today", icon: "today", color: "blue", roles: [] })} title="Today" detail="Always" />
        {choices.map((c) => {
          const n = picked.indexOf(c.href);
          return (
            <ListRow
              key={c.href}
              onClick={() => toggle(c.href)}
              leading={tile(c)}
              title={c.label}
              detail={n >= 0 ? `${n + 2}` : undefined}
              trailing={<CheckCircle checked={n >= 0} onChange={() => toggle(c.href)} label={c.label} />}
            />
          );
        })}
      </ListSection>
    </FormSheet>
  );
}
