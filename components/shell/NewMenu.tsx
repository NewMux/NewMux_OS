"use client";

import { useRouter } from "next/navigation";
import { BookOpen, CircleCheckBig, FileText, Handshake, Plus, Receipt } from "lucide-react";
import { Menu } from "@/components/ui/Menu";
import { NavButton } from "@/components/ui/Page";

const ITEMS = {
  deal: { label: "New Deal", href: "/crm/pipeline?new=1", icon: Handshake },
  task: { label: "New Task", href: "/tasks?new=1", icon: CircleCheckBig },
  invoice: { label: "New Invoice", href: "/documents/new?type=invoice", icon: FileText },
  expense: { label: "New Expense", href: "/finance/expenses?new=1", icon: Receipt },
  page: { label: "New Wiki Page", href: "/wiki?new=1", icon: BookOpen },
} as const;

export type NewItemKind = keyof typeof ITEMS;

/** The one "+" button: every "create" shortcut behind a single menu. */
export function NewMenu({ kinds }: { kinds: NewItemKind[] }) {
  const router = useRouter();
  return (
    <Menu
      label="Create"
      trigger={
        <NavButton label="Create">
          <Plus className="h-5 w-5" />
        </NavButton>
      }
      items={kinds.map((k) => ({ label: ITEMS[k].label, icon: ITEMS[k].icon, onSelect: () => router.push(ITEMS[k].href) }))}
    />
  );
}
