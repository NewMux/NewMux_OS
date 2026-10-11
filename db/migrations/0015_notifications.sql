-- Push notifications and reminders.

-- One row per device that turned notifications on (Settings → Notifications).
-- endpoint/p256dh/auth come from the browser's PushManager.subscribe().
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  device text,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);
create index push_subscriptions_user on push_subscriptions(user_id);
alter table push_subscriptions enable row level security;

-- "Remind me at …": set from Haman (or later a screen), sent once at remind_at.
create table reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  body text,
  href text,
  remind_at timestamptz not null,
  sent_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index reminders_due on reminders(remind_at) where sent_at is null;
alter table reminders enable row level security;

-- What has already been sent to whom, so the every-few-minutes check sends
-- each follow-up, task, meeting or renewal notice once (key = kind:id:when).
create table notification_log (
  user_id uuid not null references users(id) on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table notification_log enable row level security;
