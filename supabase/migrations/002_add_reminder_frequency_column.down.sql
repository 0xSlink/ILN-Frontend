-- Rollback for 002_add_reminder_frequency_column.sql
-- Safely drops reminder_frequency column from public.reminder_preferences

alter table public.reminder_preferences
  drop column if exists reminder_frequency;
