import { query } from "@/lib/db";
import { many, one, must, buildUpdate, NotFoundError, ValidationError } from "./sql";
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
    `insert into clients (name, industry, website, email, phone, billing_address, notes)
     values ($1, $2, $3, $4, $5, $6, $7) returning *`,
    [
      input.name,
      input.industry ?? null,
      input.website ?? null,
      input.email ?? null,
      input.phone ?? null,
      input.billingAddress ?? null,
      input.notes ?? null,
    ],
  );
}

const CLIENT_FIELDS = ["name", "industry", "website", "email", "phone", "billingAddress", "notes"] as const;

export async function updateClient(id: string, patch: Partial<ClientInput>): Promise<Client> {
  const { set, values } = buildUpdate(patch, CLIENT_FIELDS, 2);
  if (!set) return must<Client>("Client", "select * from clients where id = $1", [id]);
  return must<Client>("Client", `update clients set ${set}, updated_at = now() where id = $1 returning *`, [id, ...values]);
}

/**
 * NFR: a client referenced by non-archived documents can't be deleted
 * (documents.client_id is also ON DELETE RESTRICT at the database level).
 */
export async function deleteClient(id: string): Promise<void> {
  const blocking = await query<{ document_number: string }>(
    "select document_number from documents where client_id = $1 and status <> 'archived'",
    [id],
  );
  if (blocking.length > 0) {
    throw new ValidationError(
      `This client has ${blocking.length} active document(s) (${blocking.map((d) => d.document_number).join(", ")}). Archive them first.`,
    );
  }
  const archived = await query("select 1 from documents where client_id = $1 limit 1", [id]);
  if (archived.length > 0) {
    throw new ValidationError("This client has archived documents on record, so it is kept for bookkeeping.");
  }
  const rows = await query("delete from clients where id = $1 returning id", [id]);
  if (rows.length === 0) throw new NotFoundError("Client");
}

export async function listProducts(): Promise<Product[]> {
  return many<Product>("select * from products order by name");
}
