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

## Migration & Rollback Strategy (Issue 689)

To ensure zero-downtime releases and safe recovery if a frontend deployment must be rolled back, all database schema changes follow a **strict paired migration and rollback model**:

1. **Versioned Up/Down Pairs**: Every schema change in `supabase/migrations/` must have both a forward migration (`<version>_<name>.sql`) and a rollback migration (`<version>_<name>.down.sql`).
2. **Schema Tracking Table**: Migrations record their execution state in `public._schema_migrations` (version, name, SHA256 checksum, applied_at).
3. **Transactional Execution**: Migrations are wrapped in `BEGIN; ... COMMIT;` blocks to ensure atomic changes.

### Available Migration Commands

| Command | Purpose |
| :--- | :--- |
| `pnpm run db:status` | Inspect all discovered migrations and check rollback readiness |
| `pnpm run db:verify` | Verify that every migration has a matching, non-empty rollback script |
| `pnpm run db:dry-run up` | Output the complete transactional SQL to apply pending migrations |
| `pnpm run db:dry-run down` | Output the transactional rollback SQL for the latest migration |
| `pnpm run db:migrate` | Generate and execute forward migrations |
| `pnpm run db:rollback` | Generate and execute rollback migrations |

---

## Zero-Downtime Schema Evolution Guidelines

When updating the Supabase schema alongside frontend features, adhere to the **Expand and Contract pattern**:

1. **Step 1 — Expand (Additive Changes)**:
   - Add new columns as nullable or with sensible defaults (e.g. `002_add_reminder_frequency_column.sql`).
   - Create new tables or non-blocking indexes (`CREATE INDEX CONCURRENTLY` where applicable).
   - Old frontend code continues to function without errors.
2. **Step 2 — Deploy & Verify Frontend**:
   - Deploy new frontend version to Staging preview and run read-only smoke checks (`e2e/mainnet-smoke.spec.ts`).
   - Promote to Production via the manual promotion gate.
3. **Step 3 — Contract (Cleanup)**:
   - In a later release after the old version is fully decommissioned, remove deprecated columns or backfill data.

---

## Incident Rollback Playbook

If a frontend release must be rolled back due to a critical incident (SEV-1):

1. **Frontend Rollback First**:
   - Execute `vercel rollback` to immediately restore the last known-good frontend deployment (see [docs/incident-response.md](./incident-response.md)).
   - Because of the Expand pattern, the previous frontend code remains fully compatible with the additive database schema.
2. **Database Rollback (If Required)**:
   - Generate the rollback script: `pnpm run db:dry-run down`
   - Review the generated SQL in the terminal.
   - Execute the rollback SQL in the Supabase Dashboard SQL Editor or via `psql`.
   - Verify table structure: `SELECT * FROM public._schema_migrations;`

---

## Migration History

| Version | Migration Script | Rollback Script | Purpose |
| :--- | :--- | :--- | :--- |
| `001` | [001_init_reminders.sql](../supabase/migrations/001_init_reminders.sql) | [001_init_reminders.down.sql](../supabase/migrations/001_init_reminders.down.sql) | Initial tables for reminder preferences & sent logs |
| `002` | [002_add_reminder_frequency_column.sql](../supabase/migrations/002_add_reminder_frequency_column.sql) | [002_add_reminder_frequency_column.down.sql](../supabase/migrations/002_add_reminder_frequency_column.down.sql) | Additive reminder frequency preference field |
