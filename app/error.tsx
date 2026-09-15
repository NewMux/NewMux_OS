"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AlertTriangle } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] render error", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg items-center justify-center py-16">
      <Card className="w-full text-center">
        <div className="mx-auto mb-3 w-fit rounded-full bg-tone-danger/20 p-2.5">
          <AlertTriangle className="h-5 w-5 text-tone-danger-fg" aria-hidden />
        </div>
        <h1 className="mb-1 text-base font-semibold text-foreground">
          This page hit an error
        </h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Nothing was saved. Try again, and if it keeps happening the details
          are in the server log.
        </p>
        {error.digest && (
          <p className="mb-4 font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        )}
        <Button onClick={reset}>Try again</Button>
      </Card>
    </div>
  );
}
