import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessCompany } from "@/lib/rbac";
import { listVentures } from "@/lib/data/finance";
import { VenturesScreen } from "./VenturesScreen";

export const metadata = { title: "Ventures" };

export default async function VenturesPage() {
  const session = await auth();
  if (!canAccessCompany(session)) redirect("/home");
  return <VenturesScreen ventures={await listVentures()} />;
}
