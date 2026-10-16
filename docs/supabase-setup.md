# Supabase setup for local development

The frontend uses Supabase for the payer reminder opt-in flow. The browser hook in [src/hooks/useLPSettings.ts](../src/hooks/useLPSettings.ts) writes to the `reminder_preferences` table, while the server route in [app/api/reminders/route.ts](../app/api/reminders/route.ts) reads from `reminder_preferences` and writes to `sent_reminders` through the admin client.

## Expected schema

The current implementation expects two tables:

### `public.reminder_preferences`

| Column       | Type          | Notes                                                              |
| ------------ | ------------- | ------------------------------------------------------------------ |
| `address`    | `text`        | Primary key; stores the wallet address that opted in to reminders. |
| `email`      | `text`        | Required email address for reminder delivery.                      |
| `enabled`    | `boolean`     | Defaults to `true`; the unsubscribe flow flips this to `false`.    |
| `updated_at` | `timestamptz` | Defaults to `now()` and is refreshed on each upsert.               |

### `public.sent_reminders`

| Column       | Type          | Notes                                                           |
| ------------ | ------------- | --------------------------------------------------------------- |
| `id`         | `uuid`        | Default `gen_random_uuid()`; primary key.                       |
| `invoice_id` | `text`        | The invoice identifier used to avoid duplicate reminder emails. |
| `milestone`  | `int`         | Expected values are `24` or `72`.                               |
| `sent_at`    | `timestamptz` | Timestamp of the reminder dispatch.                             |
| `email`      | `text`        | The address that received the reminder.                         |

### Indexes and constraints

- `idx_sent_reminders_invoice_milestone` on `(invoice_id, milestone)` to avoid duplicate sends for the same reminder window.
- `milestone` should be limited to `24` or `72` for the current reminder logic.

## Local setup workflow

1. Create a new Supabase project or use a local Supabase instance.
2. Set the following environment variables in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (only required for reminder cron/server-side writes)
3. Apply the SQL in [supabase/migrations/001_init_reminders.sql](../supabase/migrations/001_init_reminders.sql).
4. Restart the Next.js dev server so the new env vars are picked up.

## RLS note

The current routes use the Supabase admin client when `SUPABASE_SERVICE_ROLE_KEY` is present, so they can bypass RLS during server-side reminder processing. The migration included below uses permissive local-development policies so a contributor can test the browser flow quickly. For a production deployment, replace these local policies with stricter rules that only allow the intended user or service role access.

## Migration SQL

The matching starter migration lives at [supabase/migrations/001_init_reminders.sql](../supabase/migrations/001_init_reminders.sql).
