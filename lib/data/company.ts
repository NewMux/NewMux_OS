import { randomUUID } from "crypto";
import { store } from "./store";
import type { CompanyProfile, Certification, Partnership, CertificationStatus } from "./types";

export async function getCompanyProfile(): Promise<CompanyProfile> {
  return store.companyProfile;
}

export async function updateCompanyProfile(patch: Partial<Pick<CompanyProfile, "crRenewalDate" | "mainDomain" | "mainDomainRenewalDate">>) {
  Object.assign(store.companyProfile, patch);
  return store.companyProfile;
}

export async function addCertification(input: { name: string; status: CertificationStatus; expiryDate?: string | null }): Promise<Certification> {
  const cert: Certification = { id: randomUUID(), name: input.name, status: input.status, expiryDate: input.expiryDate ?? null };
  store.companyProfile.certifications.push(cert);
  return cert;
}

export async function addPartnership(input: { name: string; description?: string | null }): Promise<Partnership> {
  const partnership: Partnership = { id: randomUUID(), name: input.name, description: input.description ?? null };
  store.companyProfile.partnerships.push(partnership);
  return partnership;
}
