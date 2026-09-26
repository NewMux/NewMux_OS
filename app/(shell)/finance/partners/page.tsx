import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { getPartyBalances, listBankAccounts, listPayouts } from "@/lib/data/ledger";
import { listParties } from "@/lib/data/finance";
import { listDocuments } from "@/lib/data/documents";
import { PartnersScreen } from "./PartnersScreen";

export const metadata = { title: "Partner Payouts" };

export default async function PartnersPage() {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/home");
  const [{ partners, funds }, payouts, parties, accounts, invoices] = await Promise.all([
    getPartyBalances(),
    listPayouts(),
    listParties(),
    listBankAccounts({ activeOnly: true }),
    listDocuments({ type: "invoice" }),
  ]);
  return (
    <PartnersScreen
      partners={partners}
      funds={funds}
      payouts={payouts}
      parties={parties}
      accounts={accounts}
      invoices={invoices
        .filter((d) => d.status !== "draft" && d.status !== "void")
        .map((d) => ({ id: d.id, label: `${d.documentNumber}${d.externalRef ? ` (${d.externalRef})` : ""} · ${d.clientShortName ?? d.clientName}` }))}
    />
  );
}
