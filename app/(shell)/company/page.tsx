import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { getCompanyProfile } from "@/lib/data/company";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AddCertificationModal } from "@/components/company/AddCertificationModal";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-tone-success/20 text-tone-success-fg",
  pending: "bg-tone-warning/20 text-tone-warning-fg",
  expired: "bg-tone-danger/20 text-tone-danger-fg",
};

export default async function CompanyProfilePage() {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/dashboard");

  const profile = await getCompanyProfile();
  const crDueSoon = profile.crRenewalDate && new Date(profile.crRenewalDate).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
  const domainDueSoon =
    profile.mainDomainRenewalDate && new Date(profile.mainDomainRenewalDate).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold text-foreground">Company Profile</h1>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Registration & Domains</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <p className="text-secondary-foreground">CR Number: {profile.crNumber}</p>
          <p className={cn(crDueSoon ? "text-warning" : "text-secondary-foreground")}>
            CR Renewal: {profile.crRenewalDate ? new Date(profile.crRenewalDate).toLocaleDateString() : "—"}
          </p>
          <p className="text-secondary-foreground">Main Domain: {profile.mainDomain}</p>
          <p className={cn(domainDueSoon ? "text-warning" : "text-secondary-foreground")}>
            Domain Renewal: {profile.mainDomainRenewalDate ? new Date(profile.mainDomainRenewalDate).toLocaleDateString() : "—"}
          </p>
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Certifications & Accreditations</CardTitle>
          <AddCertificationModal />
        </CardHeader>
        <div className="flex flex-col gap-2">
          {profile.certifications.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
              <span className="text-foreground">{c.name}</span>
              <Badge className={cn(STATUS_STYLES[c.status], "capitalize")}>{c.status}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Partnerships</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-2">
          {profile.partnerships.map((p) => (
            <div key={p.id} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
              <p className="text-foreground">{p.name}</p>
              {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
            </div>
          ))}
        </div>
      </Card>

      <Card className="text-sm text-muted-foreground">
        Sensitive company accounts (banking, Microsoft 365 admin, social media) are stored encrypted in the{" "}
        <a href="/vault" className="text-brand hover:underline">
          Secrets Vault
        </a>{" "}
        — restricted to admin, never plaintext.
      </Card>
    </div>
  );
}
