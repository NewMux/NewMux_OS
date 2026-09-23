import { query } from "@/lib/db";
import { many, must, buildUpdate, NotFoundError } from "./sql";
import type { Certification, CertificationStatus, CompanyProfile, Partnership } from "./types";

type ProfileRow = Omit<CompanyProfile, "certifications" | "partnerships">;

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const [profile, certifications, partnerships] = await Promise.all([
    must<ProfileRow>("Company profile", "select * from company_profile where id = 1"),
    many<Certification>("select id, name, status, expiry_date from certifications order by name"),
    many<Partnership>("select id, name, description from partnerships order by name"),
  ]);
  return { ...profile, certifications, partnerships };
}

const PROFILE_FIELDS = ["legalName", "crNumber", "crRenewalDate", "mainDomain", "mainDomainRenewalDate", "vatNumber", "address", "phone", "email"] as const;

export async function updateCompanyProfile(patch: Partial<ProfileRow>): Promise<CompanyProfile> {
  const { set, values } = buildUpdate(patch, PROFILE_FIELDS);
  if (set) await query(`update company_profile set ${set} where id = 1`, values);
  return getCompanyProfile();
}

export async function addCertification(input: { name: string; status: CertificationStatus; expiryDate?: string | null }): Promise<Certification> {
  return must<Certification>(
    "Certification",
    "insert into certifications (name, status, expiry_date) values ($1,$2,$3) returning id, name, status, expiry_date",
    [input.name, input.status, input.expiryDate ?? null],
  );
}

export async function updateCertification(id: string, input: { name: string; status: CertificationStatus; expiryDate?: string | null }): Promise<Certification> {
  return must<Certification>(
    "Certification",
    "update certifications set name = $2, status = $3, expiry_date = $4 where id = $1 returning id, name, status, expiry_date",
    [id, input.name, input.status, input.expiryDate ?? null],
  );
}

export async function deleteCertification(id: string): Promise<void> {
  const rows = await query("delete from certifications where id = $1 returning id", [id]);
  if (!rows.length) throw new NotFoundError("Certification");
}

export async function addPartnership(input: { name: string; description?: string | null }): Promise<Partnership> {
  return must<Partnership>("Partnership", "insert into partnerships (name, description) values ($1,$2) returning id, name, description", [
    input.name,
    input.description ?? null,
  ]);
}

export async function deletePartnership(id: string): Promise<void> {
  const rows = await query("delete from partnerships where id = $1 returning id", [id]);
  if (!rows.length) throw new NotFoundError("Partnership");
}
