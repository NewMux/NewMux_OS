-- Invoices & documents (Improvements PRD items 7–11, 37).

-- 8. The number a document had before NEWMUX OS (e.g. #00267, Quotation #2605).
alter table documents add column external_ref text;

-- 9. Void (with a reason) instead of delete; credit notes point at their invoice.
alter table documents add column void_reason text;
alter table documents add column voided_at timestamptz;
alter table documents add column credit_for_id uuid references documents(id) on delete set null;
create index idx_documents_credit_for on documents(credit_for_id) where credit_for_id is not null;

-- 11. More payment methods.
alter table payments drop constraint payments_method_check;
alter table payments add constraint payments_method_check
  check (method in ('cash', 'transfer', 'card', 'cheque', 'benefitpay', 'paypal', 'upwork', 'other'));

-- 10. Invoices no longer use the quote/contract states: an accepted or signed
--     invoice is simply sent (paid is derived from payments).
insert into document_status_history (document_id, from_status, to_status, changed_by)
select id, status, 'sent', null from documents where type = 'invoice' and status in ('accepted', 'signed');
update documents set status = 'sent', updated_at = now() where type = 'invoice' and status in ('accepted', 'signed');

-- 9. Demo invoices were "removed" by deleting their payments and archiving
--    them. An archived invoice with no payments at all is void, not revenue.
insert into document_status_history (document_id, from_status, to_status, changed_by)
select d.id, 'archived', 'void', null from documents d
where d.type = 'invoice' and d.status = 'archived' and not exists (select 1 from payments p where p.document_id = d.id);
update documents d
set status = 'void', voided_at = now(), updated_at = now(),
    void_reason = 'Archived with no payments recorded (test or demo data).'
where d.type = 'invoice' and d.status = 'archived' and not exists (select 1 from payments p where p.document_id = d.id);

-- 37. Every open quote gets a deal, so the pipeline carries its value.
create temporary table quote_deals as
select d.id as document_id, gen_random_uuid() as deal_id, d.client_id, d.status, d.total_cents, d.currency,
  d.created_by, d.project_id, d.accepted_at, d.created_at,
  coalesce((select li.description from document_line_items li where li.document_id = d.id order by li.sort_order limit 1),
           'Quote ' || d.document_number) as title
from documents d
where d.type = 'quote' and d.deal_id is null and d.status in ('draft', 'sent', 'accepted');

insert into deals (id, title, client_id, stage, value_cents, currency, probability, owner_id, project_id, won_at, closed_at, notes, created_by, created_at)
select deal_id, title, client_id,
  (case status when 'accepted' then 'won' when 'sent' then 'proposal' else 'qualified' end)::deal_stage,
  total_cents, currency,
  case status when 'accepted' then 100 when 'sent' then 50 else 25 end,
  created_by, project_id,
  case when status = 'accepted' then coalesce(accepted_at, now()) end,
  case when status = 'accepted' then coalesce(accepted_at, now()) end,
  'Created from its quote.', created_by, created_at
from quote_deals;

update documents d set deal_id = q.deal_id from quote_deals q where d.id = q.document_id;
drop table quote_deals;
