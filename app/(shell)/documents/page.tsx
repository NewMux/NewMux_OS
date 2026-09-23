import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { listDocuments } from "@/lib/data/documents";
import { DocumentsScreen } from "./DocumentsScreen";

export const metadata = { title: "Invoices & Quotes" };

export default async function DocumentsPage() {
  const session = await auth();
  if (!canAccessDocuments(session)) redirect("/home");
  return <DocumentsScreen documents={await listDocuments()} />;
}
