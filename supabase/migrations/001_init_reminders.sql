create extension if not exists pgcrypto;

create table if not exists public.reminder_preferences (
  address text primary key,
  email text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.sent_reminders (
  id uuid not null default gen_random_uuid() primary key,
  invoice_id text not null,
  milestone integer not null check (milestone in (24, 72)),
  sent_at timestamptz not null default now(),
  email text not null
);

create index if not exists idx_sent_reminders_invoice_milestone
  on public.sent_reminders (invoice_id, milestone);

alter table public.reminder_preferences enable row level security;
alter table public.sent_reminders enable row level security;

drop policy if exists "local-dev-reminder-preferences" on public.reminder_preferences;
create policy "local-dev-reminder-preferences"
  on public.reminder_preferences
  for all
  using (true)
  with check (true);

drop policy if exists "local-dev-sent-reminders" on public.sent_reminders;
create policy "local-dev-sent-reminders"
  on public.sent_reminders
  for all
  using (true)
  with check (true);
