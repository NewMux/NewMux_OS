import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { getFundActivity, getPartnerEntitlements, getPartyBalances, listBankAccounts, listPayouts } from "@/lib/data/ledger";
import { listParties } from "@/lib/data/finance";
import { listDocuments } from "@/lib/data/documents";
import { many } from "@/lib/data/sql";
import { expenseBhdCents } from "@/lib/data/profit";
import { formatDate } from "@/lib/time";
import type { Currency } from "@/lib/data/types";
import { PartyScreen } from "./PartyScreen";

export default async function PartyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/home");
  const { id } = await params;
  const parties = await listParties();
  const party = parties.find((p) => p.id === id);
  if (!party) notFound();

  const [{ partners, funds }, payouts, accounts, invoices] = await Promise.all([
    getPartyBalances(),
    listPayouts({ partyId: id }),
    listBankAccounts({ activeOnly: true }),
    listDocuments({ type: "invoice" }),
  ]);
  const invoiceOptions = invoices
    .filter((d) => d.status !== "draft" && d.status !== "void")
    .map((d) => ({ id: d.id, label: `${d.documentNumber}${d.externalRef ? ` (${d.externalRef})` : ""} · ${d.clientShortName ?? d.clientName}` }));
  const label = (inv: { documentNumber: string; externalRef: string | null; clientName: string }) => `${inv.clientName} · ${inv.externalRef ?? inv.documentNumber}`;

  if (party.kind === "fund") {
    const activity = await getFundActivity(id);
    return (
      <PartyScreen
        party={party}
        fund={funds.find((f) => f.party.id === id)}
        entitlements={activity.accruals
          .map((a) => ({ invoiceId: a.invoice.id, label: label(a.invoice), subtitle: formatDate(a.invoice.issuedAt), bhdCents: a.bhdCents }))
          .reverse()}
        payouts={payouts}
        reimbursable={[]}
        spending={activity.spending.map((s) => ({ id: s.id, description: s.description, spentOn: s.spentOn, bhdCents: s.bhdCents }))}
        parties={parties}
        accounts={accounts}
        invoices={invoiceOptions}
      />
    );
  }

  const [entitlements, reimbursable] = await Promise.all([
    getPartnerEntitlements(id),
    many<{ id: string; description: string; spentOn: string; currency: Currency; amountCents: number; amountBhdCents: number | null }>(
      "select id, description, spent_on, currency, amount_cents, amount_bhd_cents from expenses where paid_by_party_id = $1 and reimbursement_status = 'pending' order by spent_on",
      [id],
    ),
  ]);
  return (
    <PartyScreen
      party={party}
      partner={partners.find((p) => p.party.id === id)}
      entitlements={entitlements.map((e) => ({
        invoiceId: e.invoice.id,
        label: label(e.invoice),
        subtitle: `${formatDate(e.invoice.issuedAt)} · ${e.percentageBps / 100}%`,
        bhdCents: e.bhdCents,
      }))}
      payouts={payouts}
      reimbursable={reimbursable.map((e) => ({ id: e.id, description: e.description, spentOn: e.spentOn, bhdCents: expenseBhdCents(e) }))}
      spending={[]}
      parties={parties}
      accounts={accounts}
      invoices={invoiceOptions}
    />
  );
}
