import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessCompany } from "@/lib/rbac";
import { getCompanyProfile } from "@/lib/data/company";
import { listExpiringFiles, listFiles } from "@/lib/data/files";
import { CompanyScreen } from "@/components/company/CompanyScreen";

export const metadata = { title: "Company" };

export default async function CompanyPage() {
  const session = await auth();
  if (!canAccessCompany(session)) redirect("/home");
  const [profile, files, expiring] = await Promise.all([getCompanyProfile(), listFiles(), listExpiringFiles()]);
  return <CompanyScreen profile={profile} files={{ total: files.length, expiring: expiring.length }} />;
}
