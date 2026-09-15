import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { listVentures } from "@/lib/data/finance";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  planning: "bg-tone-neutral/20 text-secondary-foreground",
  in_development: "bg-tone-warning/20 text-tone-warning-fg",
  launched: "bg-tone-success/20 text-tone-success-fg",
  paused: "bg-tone-muted/20 text-tone-muted-fg",
};

export default async function VenturesPage() {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/dashboard");

  const ventures = await listVentures();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Newmux&apos;s Own Ventures</h1>
      <p className="mb-4 text-xs text-muted-foreground">
        Personally held by the founders, not Newmux company assets. Ownership and profit-split are configured in
        Settings once finalized.
      </p>
      <div className="flex flex-col gap-2">
        {ventures.map((v) => (
          <Link key={v.id} href={`/ventures/${v.id}`}>
            <Card className="transition-colors hover:border-primary/40">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{v.name}</p>
                  {v.brandDescription && <p className="text-xs text-muted-foreground">{v.brandDescription}</p>}
                </div>
                <Badge className={cn(STATUS_STYLES[v.launchStatus], "capitalize")}>
                  {v.launchStatus.replace("_", " ")}
                </Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
