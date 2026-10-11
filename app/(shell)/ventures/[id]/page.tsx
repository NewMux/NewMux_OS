import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessCompany, canSeeMoney } from "@/lib/rbac";
import { getRuleForScope, getVentureById, listDeductionTypes, listParties } from "@/lib/data/finance";
import { getVentureSpend, listExpenses } from "@/lib/data/expenses";
import { VentureDetail } from "./VentureDetail";

export default async function VenturePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canAccessCompany(session)) redirect("/home");
  const { id } = await params;
  const venture = await getVentureById(id);
  if (!venture) notFound();
  if (!canSeeMoney(session)) return <VentureDetail venture={venture} />;
  const [rule, parties, deductionTypes, spend, expenses] = await Promise.all([
    getRuleForScope("venture", id),
    listParties(),
    listDeductionTypes(),
    getVentureSpend(id),
    listExpenses({ ventureId: id }),
  ]);
  return <VentureDetail venture={venture} money={{ rule, parties, deductionTypes, spend, expenses: expenses.slice(0, 20) }} />;
}
