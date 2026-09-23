import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessCompany } from "@/lib/rbac";
import { getRuleForScope, getVentureById, listDeductionTypes, listParties } from "@/lib/data/finance";
import { VentureDetail } from "./VentureDetail";

export default async function VenturePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canAccessCompany(session)) redirect("/home");
  const { id } = await params;
  const venture = await getVentureById(id);
  if (!venture) notFound();
  const [rule, parties, deductionTypes] = await Promise.all([getRuleForScope("venture", id), listParties(), listDeductionTypes()]);
  return <VentureDetail venture={venture} rule={rule} parties={parties} deductionTypes={deductionTypes} />;
}
