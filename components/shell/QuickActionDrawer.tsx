"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useState } from "react";
import { Plus, FileText, KanbanSquare, KeyRound, X } from "lucide-react";

const ACTIONS = [
  { href: "/documents/new", label: "New Document", icon: FileText },
  { href: "/projects", label: "New Task", icon: KanbanSquare },
  { href: "/vault", label: "Look up Credential", icon: KeyRound },
];

export function QuickActionDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg md:bottom-6 md:right-6"
          aria-label="Quick actions"
        >
          <Plus className="h-6 w-6" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-white/10 bg-slate-950 p-4 safe-bottom md:inset-x-auto md:bottom-6 md:right-6 md:w-72 md:rounded-2xl md:border">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-white">Quick actions</Dialog.Title>
            <Dialog.Close className="text-slate-500 hover:text-slate-200">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="flex flex-col gap-1">
            {ACTIONS.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-200 hover:bg-slate-900"
              >
                <action.icon className="h-4 w-4 text-emerald-400" />
                {action.label}
              </Link>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
