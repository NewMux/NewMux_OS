-- Official Documents (PRD addendum 1.2): one engine for quotations,
-- invoices, contracts, proposals and official letters in the approved
-- NewMux design, with signatories, a terms library, an optional server fee,
-- signing at issue and an unchangeable PDF of what was signed.

-- --- Fixed company details, printed in every footer (section 2.4) ---
alter table company_profile add column trade_name text not null default 'NewMux';
alter table company_profile add column tagline text not null default 'Software Development & Digital Innovation';
alter table company_profile add column country text not null default 'Kingdom of Bahrain';
alter table company_profile add column website text not null default 'www.newmux.com';
alter table company_profile add column whatsapp text not null default '+973 6635 6999';
alter table company_profile add column iban text not null default 'BH96 ALSA 0032 3942 1001 00';
update company_profile set cr_number = '182684-1' where cr_number = '';
update company_profile set email = 'info@newmux.com' where email is null or email = '';

-- --- Signatories (section 4) ---
create table signatories (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  position text not null,
  -- The one login allowed to sign as this person (section 5.2).
  user_id uuid not null references users(id) on delete restrict,
  is_active boolean not null default true,
  -- Document types this person is the default signatory for, as a comma list.
  default_for text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Jassim (default) and Mohammed, where their logins exist (a new database gets them from db/seed.sql).
insert into signatories (full_name, position, user_id, default_for, sort_order)
select 'Jassim Baqer', 'Co-founder & COO', id, 'quote,proposal,contract,invoice,credit_note,letter', 0
from users where is_active and (lower(email) = 'info@newmux.com' or full_name ilike 'jassim%')
order by lower(email) = 'info@newmux.com' desc limit 1;
insert into signatories (full_name, position, user_id, sort_order)
select 'Mohammed', 'CEO', id, 1
from users where is_active and (lower(email) = 'm4ahmed7@gmail.com' or full_name ilike 'mohammed%')
order by lower(email) = 'm4ahmed7@gmail.com' desc limit 1;

-- --- Terms & Conditions library (section 6) ---
-- A template per product type; its clauses in order. Standalone clauses
-- (template_id null) can be added to any document or letter. Every saved
-- change bumps the template's version and keeps the old text.
create table terms_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  version int not null default 1,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table terms_clauses (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references terms_templates(id) on delete cascade,
  title text not null,
  body text not null,
  default_on boolean not null default true,
  sort_order int not null default 0
);
create index idx_terms_clauses_template on terms_clauses(template_id, sort_order);

create table terms_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references terms_templates(id) on delete cascade,
  version int not null,
  name text not null,
  clauses jsonb not null,
  saved_by uuid references users(id) on delete set null,
  saved_at timestamptz not null default now(),
  unique (template_id, version)
);

-- --- Documents ---
-- Letters can go to someone who isn't a client.
alter table documents alter column client_id drop not null;
alter table documents add constraint documents_client_required check (client_id is not null or type = 'letter');

alter table documents
  -- The big title: the project name, or a letter's subject.
  add column title text,
  -- Quotes, proposals and contracts: overview and scope & timeline ([{deliverable, duration}]).
  add column overview text,
  add column scope jsonb not null default '[]'::jsonb,
  -- Letters: the recipient block (one line each) and the body (blank line = new paragraph).
  add column recipient text,
  add column body text,
  -- Quotes and proposals: until when the offer stands (default 14 days).
  add column valid_until date,
  -- The signatory chosen, and on issue a snapshot of their name and position (section 4.2).
  add column signatory_id uuid references signatories(id) on delete set null,
  add column signatory_name text,
  add column signatory_position text,
  add column signed_by uuid references users(id) on delete set null,
  add column signed_at timestamptz,
  -- {templateId, templateName, version, clauses: [{title, body}]}: editable while a draft, frozen on issue.
  add column terms jsonb,
  -- Optional server fee (section 7): outside the total and the accounts.
  add column server_fee_cents bigint check (server_fee_cents is null or server_fee_cents >= 0),
  add column server_fee_cycle billing_cycle,
  add column server_fee_client_chooses boolean not null default false,
  add column server_fee_label text,
  -- The hosting subscription the fee became when the quote was converted.
  add column server_fee_subscription_id uuid references hosting_subscriptions(id) on delete set null,
  -- Versions: a revision links to the document it replaces.
  add column version int not null default 1,
  add column previous_version_id uuid references documents(id) on delete set null,
  -- SHA-256 of the issued PDF (document_pdfs).
  add column pdf_sha256 text,
  -- Delivery: an unguessable link to the issued PDF, and when and how it went.
  add column share_token text unique,
  add column sent_at timestamptz,
  add column sent_via text check (sent_via in ('email', 'whatsapp', 'download', 'other'));

create index idx_documents_previous_version on documents(previous_version_id) where previous_version_id is not null;

-- What was signed, kept as issued (section 5.2). The drawn signature exists
-- only inside this PDF.
create table document_pdfs (
  document_id uuid primary key references documents(id) on delete cascade,
  data bytea not null,
  sha256 text not null,
  size_bytes int not null,
  created_at timestamptz not null default now()
);

-- --- Starter terms (section 6.4). Wording to be reviewed by Jassim and, for contracts, legal counsel. ---
insert into terms_templates (name, sort_order) values ('ERP System', 0), ('SaaS', 1), ('Website', 2), ('Other', 3);

insert into terms_clauses (template_id, title, body, default_on, sort_order)
select t.id, c.title, c.body, c.default_on, c.ord
from terms_templates t
join (values
  ('ERP System', 1, 'Scope and deliverables', 'NewMux will deliver the modules and features listed in this document. Anything not listed is outside the scope.', true),
  ('ERP System', 2, 'Timeline', 'The timeline starts once the deposit is received and the client has provided the information and access NewMux needs. Delays in client feedback extend it accordingly.', true),
  ('ERP System', 3, 'Payment terms', 'Payments are due as set out in the payment terms, by bank transfer to the account stated in this document.', true),
  ('ERP System', 4, 'Change requests', 'Requests outside the agreed scope are quoted separately and scheduled once approved in writing.', true),
  ('ERP System', 5, 'Acceptance and delivery', 'The client reviews each delivery within 7 days. A delivery is considered accepted if no written issues are raised in that period.', true),
  ('ERP System', 6, 'Intellectual property', 'Ownership of the custom work passes to the client once paid in full. NewMux keeps the rights to its own tools, libraries and know-how used to build it.', true),
  ('ERP System', 7, 'Hosting and server fee', 'Hosting and server fees are billed separately from the project total, on the cycle stated in this document.', true),
  ('ERP System', 8, 'Support period', 'NewMux fixes defects reported within 3 months of delivery at no charge. Support after that is offered under a separate agreement.', true),
  ('ERP System', 9, 'Confidentiality', 'Both parties keep each other''s confidential information private and use it only for this project.', true),
  ('ERP System', 10, 'Termination', 'Either party may end the engagement with 30 days'' written notice. Work completed up to that date is payable.', true),
  ('ERP System', 11, 'Governing law', 'This agreement is governed by the laws of the Kingdom of Bahrain.', true),
  ('SaaS', 1, 'Service description', 'NewMux provides access to the service described in this document for the duration of the subscription.', true),
  ('SaaS', 2, 'Subscription fee and billing cycle', 'The subscription fee is billed in advance on the billing cycle stated in this document.', true),
  ('SaaS', 3, 'Term and renewal', 'The subscription renews automatically at the end of each term unless either party gives notice before the renewal date.', true),
  ('SaaS', 4, 'Data ownership and privacy', 'The client owns its data. NewMux processes it only to provide the service and protects it with reasonable security measures.', true),
  ('SaaS', 5, 'Availability and support', 'NewMux aims to keep the service available at all times and responds to support requests on business days.', true),
  ('SaaS', 6, 'Acceptable use', 'The client uses the service lawfully and does not attempt to disrupt it or access other customers'' data.', true),
  ('SaaS', 7, 'Suspension and termination', 'NewMux may suspend the service for unpaid fees after written notice. Either party may end the subscription at the end of a term.', true),
  ('SaaS', 8, 'Governing law', 'This agreement is governed by the laws of the Kingdom of Bahrain.', true),
  ('Website', 1, 'Scope and pages', 'NewMux will design and build the pages and features listed in this document.', true),
  ('Website', 2, 'Content responsibilities', 'The client provides text, images and other content on time. NewMux is not responsible for the accuracy of client content.', true),
  ('Website', 3, 'Timeline', 'The timeline starts once the deposit and the content are received.', true),
  ('Website', 4, 'Payment terms', 'Payments are due as set out in the payment terms, by bank transfer to the account stated in this document.', true),
  ('Website', 5, 'Revisions', 'The price includes two rounds of revisions per design stage. Further revisions are quoted separately.', true),
  ('Website', 6, 'Domain and hosting', 'Domain and hosting are billed separately on the cycle stated in this document, unless the client provides their own.', true),
  ('Website', 7, 'Intellectual property', 'Ownership of the final design and content passes to the client once paid in full.', true),
  ('Website', 8, 'Maintenance', 'Maintenance after launch is offered under a separate agreement.', true),
  ('Website', 9, 'Governing law', 'This agreement is governed by the laws of the Kingdom of Bahrain.', true),
  ('Other', 1, 'Scope', 'NewMux will deliver the work described in this document. Anything not listed is outside the scope.', true),
  ('Other', 2, 'Payment terms', 'Payments are due as set out in the payment terms, by bank transfer to the account stated in this document.', true),
  ('Other', 3, 'Timeline', 'The timeline starts once the deposit is received.', true),
  ('Other', 4, 'Confidentiality', 'Both parties keep each other''s confidential information private.', true),
  ('Other', 5, 'Termination', 'Either party may end the engagement with 30 days'' written notice. Work completed up to that date is payable.', true),
  ('Other', 6, 'Governing law', 'This agreement is governed by the laws of the Kingdom of Bahrain.', true)
) as c(template, ord, title, body, default_on) on c.template = t.name;

-- Standalone clauses, for any document or letter.
insert into terms_clauses (template_id, title, body, default_on, sort_order) values
  (null, 'Payment terms (50/50)', '50% on approval, 50% on delivery. Bank transfer to IBAN {iban}.', true, 0),
  (null, 'Deposit', 'The deposit is non-refundable once work has started.', true, 1),
  (null, 'Confidentiality', 'Both parties keep each other''s confidential information private and use it only for this engagement.', true, 2),
  (null, 'Validity', 'This offer is valid until the date stated in this document.', true, 3);

insert into terms_template_versions (template_id, version, name, clauses)
select t.id, 1, t.name,
  coalesce((select jsonb_agg(jsonb_build_object('title', c.title, 'body', c.body, 'defaultOn', c.default_on) order by c.sort_order)
            from terms_clauses c where c.template_id = t.id), '[]'::jsonb)
from terms_templates t;

-- Same as every table (0007_rls.sql): the app connects as the owner; RLS with
-- no policies keeps Supabase's public API out.
alter table signatories enable row level security;
alter table terms_templates enable row level security;
alter table terms_clauses enable row level security;
alter table terms_template_versions enable row level security;
alter table document_pdfs enable row level security;
