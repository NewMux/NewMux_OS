import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { getVentureById, getRuleForScope, listParties } from "@/lib/data/finance";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ExternalLink, Settings } from "lucide-react";

export default async function VentureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/dashboard");

  const { id } = await params;
  const venture = await getVentureById(id);
  if (!venture) notFound();

  const [rule, parties] = await Promise.all([getRuleForScope("venture", id), listParties()]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-white">{venture.name}</h1>
      <Badge className="mb-4 bg-slate-500/20 text-slate-300 capitalize">{venture.launchStatus.replace("_", " ")}</Badge>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Brand</CardTitle>
        </CardHeader>
        <p className="mb-2 text-sm text-slate-300">{venture.brandDescription ?? "No description yet."}</p>
        {venture.websiteUrl ? (
          <a href={venture.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-emerald-400 hover:underline">
            Website <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <p className="text-xs text-slate-500">No website link yet.</p>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profit Split</CardTitle>
        </CardHeader>
        {rule ? (
          <div className="flex flex-col gap-1 text-sm text-slate-300">
            {rule.splits.map((s, i) => (
              <p key={i}>
                {parties.find((p) => p.id === s.partyId)?.name ?? "Unknown"} — {(s.percentageBps / 100).toFixed(0)}%
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Not configured yet — ownership and split are intentionally left empty until finalized (PRD section 14).
          </p>
        )}
        <Link href="/settings" className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-400">
          <Settings className="h-3 w-3" /> Configure in Settings
        </Link>
      </Card>
    </div>
  );
}
