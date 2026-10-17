-- Migration: 002_add_reminder_frequency_column.sql
-- Purpose: Adds optional reminder_frequency setting to public.reminder_preferences
-- Rollback-safe: Additive column with default, backward compatible with existing queries

alter table public.reminder_preferences
  add column if not exists reminder_frequency text not null default 'all'
  check (reminder_frequency in ('all', 'critical_only', 'daily_summary'));
