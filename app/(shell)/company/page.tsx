import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessCompany } from "@/lib/rbac";
import { getCompanyProfile } from "@/lib/data/company";
import { CompanyScreen } from "@/components/company/CompanyScreen";

export const metadata = { title: "Company" };

export default async function CompanyPage() {
  const session = await auth();
  if (!canAccessCompany(session)) redirect("/home");
  return <CompanyScreen profile={await getCompanyProfile()} />;
}
