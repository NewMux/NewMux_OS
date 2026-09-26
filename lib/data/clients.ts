import { query } from "@/lib/db";
import { many, one, must, buildUpdate, NotFoundError } from "./sql";
import { assertNoFinancialRecords } from "./guards";
import type { Client, Product } from "./types";

export type ClientWithStats = Client & {
  contactCount: number;
  openDealCount: number;
  activeProjectCount: number;
  outstandingInvoiceCount: number;
  primaryContactName: string | null;
};

export async function listClients(): Promise<Client[]> {
  return many<Client>("select * from clients order by name");
}

export async function listClientsWithStats(): Promise<ClientWithStats[]> {
  return many<ClientWithStats>(`
    select c.*,
      (select count(*)::int from contacts ct where ct.client_id = c.id) as contact_count,
      (select count(*)::int from deals d where d.client_id = c.id and d.stage not in ('won','lost')) as open_deal_count,
      (select count(*)::int from projects p where p.client_id = c.id and p.status in ('planning','active_sprint')) as active_project_count,
      (select count(*)::int from documents doc where doc.client_id = c.id and doc.type = 'invoice'
         and doc.status in ('sent','accepted','signed')) as outstanding_invoice_count,
      (select ct.full_name from contacts ct where ct.client_id = c.id order by ct.is_primary desc, ct.created_at limit 1) as primary_contact_name
    from clients c
    order by c.name`);
}

export async function getClientById(id: string): Promise<Client | undefined> {
  return one<Client>("select * from clients where id = $1", [id]);
}

export type ClientInput = {
  name: string;
  shortName?: string | null;
  industry?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  billingAddress?: string | null;
  notes?: string | null;
};

export async function createClient(input: ClientInput): Promise<Client> {
  return must<Client>(
    "Client",
    `insert into clients (name, industry, website, email, phone, billing_address, notes, short_name)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
    [
      input.name,
      input.industry ?? null,
      input.website ?? null,
      input.email ?? null,
      input.phone ?? null,
      input.billingAddress ?? null,
      input.notes ?? null,
      input.shortName ?? null,
    ],
  );
}

const CLIENT_FIELDS = ["name", "shortName", "industry", "website", "email", "phone", "billingAddress", "notes"] as const;

export async function updateClient(id: string, patch: Partial<ClientInput>): Promise<Client> {
  const { set, values } = buildUpdate(patch, CLIENT_FIELDS, 2);
  if (!set) return must<Client>("Client", "select * from clients where id = $1", [id]);
  return must<Client>("Client", `update clients set ${set}, updated_at = now() where id = $1 returning *`, [id, ...values]);
}

/** Blocked while any document, payment, expense or hosting fee refers to the client (item 20). */
export async function deleteClient(id: string): Promise<void> {
  await assertNoFinancialRecords("client", id);
  const rows = await query("delete from clients where id = $1 returning id", [id]);
  if (rows.length === 0) throw new NotFoundError("Client");
}

export async function listProducts(): Promise<Product[]> {
  return many<Product>("select * from products order by name");
}
