-- Hosting fees (Improvements PRD items 12–14).

-- 13. The client price can be unknown ("amount TBD"); services can be not started yet.
alter table hosting_subscriptions alter column amount_cents drop not null;
alter table hosting_subscriptions drop constraint hosting_subscriptions_status_check;
alter table hosting_subscriptions add constraint hosting_subscriptions_status_check
  check (status in ('active', 'overdue', 'paused', 'not_started'));

-- 14. What the service costs NEWMUX: a linked recurring expense, or a yearly cost.
alter table hosting_subscriptions add column recurring_expense_id uuid references recurring_expenses(id) on delete set null;
alter table hosting_subscriptions add column cost_per_year_cents bigint check (cost_per_year_cents >= 0);
alter table hosting_subscriptions add column cost_currency text check (cost_currency in ('BHD', 'USD'));

-- 12. Every invoice a hosting fee was billed on (not only the latest one).
alter table documents add column hosting_subscription_id uuid references hosting_subscriptions(id) on delete set null;
create index idx_documents_hosting on documents(hosting_subscription_id) where hosting_subscription_id is not null;
update documents d set hosting_subscription_id = h.id
from hosting_subscriptions h where h.linked_invoice_id = d.id and d.hosting_subscription_id is null;
