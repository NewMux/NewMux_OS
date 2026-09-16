import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { listVentures } from "@/lib/data/finance";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Rocket } from "lucide-react";
import { VentureRowActions } from "@/components/ventures/VentureRowActions";

const STATUS_TONES: Record<string, BadgeTone> = {
  planning: "neutral",
  in_development: "warning",
  launched: "success",
  paused: "muted",
};

export default async function VenturesPage() {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/dashboard");

  const ventures = await listVentures();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-foreground">
        Newmux&apos;s Own Ventures
      </h1>
      <p className="mb-4 text-xs text-muted-foreground">
        Personally held by the founders, not Newmux company assets. Ownership
        and profit-split are configured in Settings once finalized.
      </p>
      {ventures.length === 0 && (
        <Card>
          <EmptyState
            icon={Rocket}
            title="No ventures yet"
            description="Founder-owned ventures are tracked separately from agency work."
          />
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {ventures.map((v) => (
          <Card
            key={v.id}
            className="transition-colors hover:border-primary/40"
          >
            <div className="flex items-center justify-between gap-3">
              {/* The link wraps only the text so the action menu stays clickable. */}
              <Link href={`/ventures/${v.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {v.name}
                </p>
                {v.brandDescription && (
                  <p className="truncate text-xs text-muted-foreground">
                    {v.brandDescription}
                  </p>
                )}
              </Link>
              <div className="flex shrink-0 items-center gap-1">
                <Badge
                  tone={STATUS_TONES[v.launchStatus] ?? "neutral"}
                  className="capitalize"
                >
                  {v.launchStatus.replace("_", " ")}
                </Badge>
                <VentureRowActions venture={v} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
