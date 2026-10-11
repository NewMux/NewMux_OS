import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessCompany, canSeeMoney } from "@/lib/rbac";
import { getCompanyProfile } from "@/lib/data/company";
import { fileCategoriesFor, listExpiringFiles, listFiles } from "@/lib/data/files";
import { CompanyScreen } from "@/components/company/CompanyScreen";

export const metadata = { title: "Company" };

export default async function CompanyPage() {
  const session = await auth();
  if (!canAccessCompany(session)) redirect("/home");
  const categories = fileCategoriesFor(canSeeMoney(session));
  const [profile, files, expiring] = await Promise.all([getCompanyProfile(), listFiles({ categories }), listExpiringFiles()]);
  return <CompanyScreen profile={profile} files={{ total: files.length, expiring: expiring.filter((f) => categories.includes(f.category)).length }} />;
}
