"use client";

import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function ShellError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[70dvh] items-center justify-center">
      <EmptyState
        icon={AlertTriangle}
        title="Something went wrong"
        message="This screen couldn't load. Check your connection and try again."
        action={<Button onClick={reset}>Try Again</Button>}
      />
    </div>
  );
}
