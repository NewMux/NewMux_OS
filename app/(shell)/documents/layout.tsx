import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { listDocuments } from "@/lib/data/documents";
import { SplitView } from "@/components/shell/SplitView";
import { EmptyState } from "@/components/ui/EmptyState";
import { DocumentsScreen } from "./DocumentsScreen";

/** Documents: a full-width table until one is opened, then the list beside it on iPad/Mac. */
export default async function DocumentsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!canAccessDocuments(session)) redirect("/home");
  return (
    <SplitView
      wideWhenEmpty
      list={<DocumentsScreen documents={await listDocuments()} />}
      placeholder={<EmptyState icon={FileText} title="No document selected" message="Choose an invoice, quote or contract." />}
    >
      {children}
    </SplitView>
  );
}
