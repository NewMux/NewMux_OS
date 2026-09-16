"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Eye, EyeOff, Copy } from "lucide-react";
import { SecretRowActions } from "./SecretRowActions";

const TYPE_LABEL: Record<string, string> = {
  api_token: "API token",
  db_connection: "DB connection",
  deploy_key: "Deploy key",
  ssh_login: "SSH login",
  other: "Other",
};

export function SecretRow({
  id,
  label,
  secretType,
  maskedPreview,
  canReveal,
}: {
  id: string;
  label: string;
  secretType: string;
  maskedPreview: string;
  canReveal: boolean;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReveal() {
    if (revealed) {
      setRevealed(null);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/vault/${id}/reveal`, { method: "POST" });
    setLoading(false);
    if (res.status === 401) {
      setError("Vault is locked. Unlock it above to reveal secrets.");
      return;
    }
    if (!res.ok) {
      setError("Could not reveal secret.");
      return;
    }
    const { value } = await res.json();
    setRevealed(value);
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {label}
          </p>
          <p className="text-xs text-muted-foreground">
            {TYPE_LABEL[secretType] ?? secretType}
          </p>
          <p className="mt-1 truncate font-mono text-sm text-secondary-foreground">
            {revealed ?? maskedPreview}
          </p>
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
        {canReveal && (
          <div className="flex shrink-0 items-center gap-1">
            {revealed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigator.clipboard.writeText(revealed)}
                aria-label="Copy secret"
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReveal}
              disabled={loading}
              aria-label="Reveal secret"
            >
              {revealed ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
            <SecretRowActions id={id} label={label} />
          </div>
        )}
      </div>
    </Card>
  );
}
