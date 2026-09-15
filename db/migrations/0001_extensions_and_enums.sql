-- NEWMUX OS schema: extensions and enums
-- Not yet applied to a live Supabase project (backend deferred) — kept here
-- as the source of truth to apply via mcp__Supabase__apply_migration later.

create extension if not exists pgcrypto;

create type user_role as enum ('partner_admin', 'lead_dev');
create type document_type as enum ('quote', 'contract', 'invoice');
create type document_status as enum ('draft', 'sent', 'accepted', 'signed', 'paid', 'archived');
create type task_priority as enum ('urgent', 'high', 'medium', 'low');
create type task_status as enum ('todo', 'in_progress', 'in_review', 'done');
create type project_status as enum ('planning', 'active_sprint', 'paused', 'completed', 'archived');
create type secret_type as enum ('api_token', 'db_connection', 'deploy_key', 'ssh_login', 'other');
create type saas_subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'paused');
create type campaign_channel as enum ('meta_ads', 'linkedin', 'google_search', 'outbound_email');
