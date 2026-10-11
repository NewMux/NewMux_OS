-- The Marketing role and more campaign channels. Enum values have to be
-- committed before anything uses them, so they get a migration of their own
-- (0017 uses them).

-- Everything except money: see lib/rbac.ts.
alter type user_role add value if not exists 'marketing';

alter type campaign_channel add value if not exists 'instagram';
alter type campaign_channel add value if not exists 'tiktok';
alter type campaign_channel add value if not exists 'x';
alter type campaign_channel add value if not exists 'facebook';
alter type campaign_channel add value if not exists 'youtube';
alter type campaign_channel add value if not exists 'website';
alter type campaign_channel add value if not exists 'newsletter';
alter type campaign_channel add value if not exists 'event';
alter type campaign_channel add value if not exists 'referral';
alter type campaign_channel add value if not exists 'other';
