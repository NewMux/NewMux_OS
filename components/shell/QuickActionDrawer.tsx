"use client";

import Link from "next/link";
import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Plus, FileText, KanbanSquare, KeyRound } from "lucide-react";

const ACTIONS = [
  { href: "/documents/new", label: "New Document", icon: FileText },
  { href: "/projects", label: "New Task", icon: KanbanSquare },
  { href: "/vault", label: "Look up Credential", icon: KeyRound },
];

export function QuickActionDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:bottom-6 md:right-6"
          aria-label="Quick actions"
        >
          <Plus className="h-6 w-6" />
        </button>
      </DialogTrigger>
      <DialogContent
        title="Quick actions"
        position="sheet"
        className="md:inset-x-auto md:bottom-6 md:left-auto md:right-6 md:top-auto md:w-72 md:translate-x-0 md:translate-y-0 md:rounded-2xl md:border"
      >
        <div className="flex flex-col gap-1">
          {ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              onClick={() => setOpen(false)}
              className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium text-foreground hover:bg-accent"
            >
              <action.icon className="h-4 w-4 text-brand" />
              {action.label}
            </Link>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
