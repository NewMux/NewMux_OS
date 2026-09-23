import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { listDocuments } from "@/lib/data/documents";
import { SplitView } from "@/components/shell/SplitView";
import { EmptyState } from "@/components/ui/EmptyState";
import { DocumentsScreen } from "./DocumentsScreen";

/** Invoices, quotes and contracts beside the open document on iPad/Mac. */
export default async function DocumentsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!canAccessDocuments(session)) redirect("/home");
  return (
    <SplitView list={<DocumentsScreen documents={await listDocuments()} />} placeholder={<EmptyState icon={FileText} title="No document selected" message="Choose an invoice, quote or contract." />}>
      {children}
    </SplitView>
  );
}
