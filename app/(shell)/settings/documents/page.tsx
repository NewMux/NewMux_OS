import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { isPartnerAdmin } from "@/lib/rbac";
import { getCompanyDetails } from "@/lib/data/company";
import { listSignatories } from "@/lib/data/signatories";
import { listStandaloneClauses, listTermsTemplates } from "@/lib/data/terms";
import { listTeam } from "@/lib/data/users";
import { OfficialDocsSettings } from "@/components/settings/OfficialDocsSettings";

export const metadata = { title: "Official Documents" };

/** Settings → Official Documents (partners): footer details, signatories, the Terms & Conditions library. */
export default async function OfficialDocumentsSettingsPage() {
  const session = (await auth())!;
  if (!isPartnerAdmin(session)) notFound();
  const [details, signatories, templates, standalone, team] = await Promise.all([getCompanyDetails(), listSignatories(), listTermsTemplates(), listStandaloneClauses(), listTeam()]);
  return (
    <OfficialDocsSettings
      details={details}
      signatories={signatories}
      templates={templates}
      standalone={standalone}
      logins={team.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.fullName, email: u.email }))}
    />
  );
}
