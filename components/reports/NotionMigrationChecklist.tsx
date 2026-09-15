"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";

const SECTIONS = ["Projects", "Finance", "Owned Products", "Hosting", "Documents", "Tasks", "Meetings"];

export function NotionMigrationChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Notion Migration Checklist</CardTitle>
      </CardHeader>
      <p className="mb-3 text-xs text-muted-foreground">
        One-time check before Notion is retired for company operations (PRD 15.5). Not persisted — recheck each
        section against the live Notion hub, then retire it once everything below is confirmed.
      </p>
      <div className="flex flex-col gap-1">
        {SECTIONS.map((section) => (
          <label key={section} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={!!checked[section]}
              onChange={(e) => setChecked((prev) => ({ ...prev, [section]: e.target.checked }))}
              className="h-4 w-4 rounded border-border bg-card"
            />
            {section} migrated and confirmed
          </label>
        ))}
      </div>
    </Card>
  );
}
