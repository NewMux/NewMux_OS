"use client";

import { useState } from "react";
import { Pencil, Scale } from "lucide-react";
import { Menu } from "@/components/ui/Menu";
import { Button } from "@/components/ui/Button";
import { AccountSheet, ReconcileSheet } from "./LedgerSheets";
import type { BankAccount } from "@/lib/data/types";

/** Edit / reconcile controls for an account's statement page. */
export function AccountActions({ account, menuOnly }: { account: BankAccount; menuOnly?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  return (
    <>
      {menuOnly ? (
        <Menu
          items={[
            { label: "Reconcile", icon: Scale, onSelect: () => setReconciling(true) },
            { label: "Edit Account", icon: Pencil, onSelect: () => setEditing(true) },
          ]}
        />
      ) : (
        <div className="flex gap-3">
          <Button className="flex-1" onClick={() => setReconciling(true)}>
            Reconcile with Statement
          </Button>
          <Button className="flex-1" variant="secondary" onClick={() => setEditing(true)}>
            Opening Balance
          </Button>
        </div>
      )}
      <AccountSheet account={account} open={editing} onOpenChange={setEditing} />
      <ReconcileSheet account={account} open={reconciling} onOpenChange={setReconciling} />
    </>
  );
}
