-- Expenses (Improvements PRD items 15, 16, 38).

-- 15. Venture spending.
alter table expenses add column linked_venture_id uuid references ventures(id) on delete set null;
alter table recurring_expenses add column linked_venture_id uuid references ventures(id) on delete set null;
create index idx_expenses_venture on expenses(linked_venture_id) where linked_venture_id is not null;

-- Expenses tagged "[Tbadel]" (or any venture's name or slug) in the text get the real link.
update expenses e set linked_venture_id = v.id from ventures v
where e.linked_venture_id is null
  and (position(lower('[' || v.name || ']') in lower(e.description)) > 0
    or position(lower('[' || v.slug || ']') in lower(e.description)) > 0);
update recurring_expenses r set linked_venture_id = v.id from ventures v
where r.linked_venture_id is null
  and (position(lower('[' || v.name || ']') in lower(r.name)) > 0
    or position(lower('[' || v.slug || ']') in lower(r.name)) > 0);

-- 16. Who paid: the company account (null) or a partner personally, who is then owed it back.
alter table expenses add column paid_by_party_id uuid references parties(id) on delete restrict;
alter table expenses add column reimbursement_status text not null default 'not_required'
  check (reimbursement_status in ('not_required', 'pending', 'reimbursed'));
alter table expenses add column reimbursement_payout_id uuid references payouts(id) on delete set null;
alter table recurring_expenses add column paid_by_party_id uuid references parties(id) on delete restrict;

-- 38. A photo of the receipt.
alter table expenses add column receipt_file_id uuid references files(id) on delete set null;
