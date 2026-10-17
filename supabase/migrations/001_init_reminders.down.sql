-- Rollback for 001_init_reminders.sql
-- Safely drops policies, indexes, and tables created in 001_init_reminders.sql

drop policy if exists "local-dev-sent-reminders" on public.sent_reminders;
drop policy if exists "local-dev-reminder-preferences" on public.reminder_preferences;
drop index if exists public.idx_sent_reminders_invoice_milestone;
drop table if exists public.sent_reminders cascade;
drop table if exists public.reminder_preferences cascade;
