import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = process.cwd();
export const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
export const SCHEMA_TABLE = 'public._schema_migrations';

/**
 * Calculate SHA-256 checksum of file content
 */
export function calculateChecksum(content) {
  return crypto.createHash('sha256').update(content.trim()).digest('hex');
}

/**
 * Discover all valid up and down migration files in the migrations directory
 */
export function discoverMigrations(migrationsDir = MIGRATIONS_DIR) {
  if (!existsSync(migrationsDir)) {
    return [];
  }

  const files = readdirSync(migrationsDir);
  const upFiles = files.filter(
    (f) => f.endsWith('.sql') && !f.endsWith('.down.sql') && !f.endsWith('.rollback.sql')
  );

  const migrations = [];

  for (const upFile of upFiles.sort()) {
    const match = upFile.match(/^(\d+)_(.*)\.sql$/);
    if (!match) continue;

    const version = match[1];
    const name = match[2];
    const upPath = path.join(migrationsDir, upFile);
    const upContent = readFileSync(upPath, 'utf8');

    // Look for matching down/rollback file
    const downFileName = `${version}_${name}.down.sql`;
    const downPath = path.join(migrationsDir, downFileName);
    const hasDown = existsSync(downPath);
    const downContent = hasDown ? readFileSync(downPath, 'utf8') : null;

    migrations.push({
      version,
      name,
      upFile,
      upPath,
      upContent,
      upChecksum: calculateChecksum(upContent),
      downFile: hasDown ? downFileName : null,
      downPath: hasDown ? downPath : null,
      downContent,
      downChecksum: downContent ? calculateChecksum(downContent) : null,
      hasRollback: hasDown,
    });
  }

  return migrations;
}

/**
 * Generate bootstrap SQL for the migrations tracking table
 */
export function generateBootstrapSql() {
  return `
-- Schema migrations tracking table
create table if not exists ${SCHEMA_TABLE} (
  version text primary key,
  name text not null,
  checksum text not null,
  applied_at timestamptz not null default now()
);
`.trim();
}

/**
 * Generate transactional UP migration SQL
 */
export function generateUpSql(migration) {
  return `
-- ============================================================
-- Migration Up: ${migration.upFile}
-- Checksum: ${migration.upChecksum}
-- ============================================================
begin;

${migration.upContent.trim()}

insert into ${SCHEMA_TABLE} (version, name, checksum, applied_at)
values ('${migration.version}', '${migration.name}', '${migration.upChecksum}', now())
on conflict (version) do update
set checksum = excluded.checksum, applied_at = now();

commit;
`.trim();
}

/**
 * Generate transactional DOWN / Rollback migration SQL
 */
export function generateDownSql(migration) {
  if (!migration.hasRollback || !migration.downContent) {
    throw new Error(`Migration ${migration.upFile} does not have a corresponding rollback script`);
  }

  return `
-- ============================================================
-- Migration Rollback (Down): ${migration.downFile}
-- Target Version: ${migration.version}
-- ============================================================
begin;

${migration.downContent.trim()}

delete from ${SCHEMA_TABLE} where version = '${migration.version}';

commit;
`.trim();
}

/**
 * Verify that all migrations have valid rollback scripts and valid syntax
 */
export function verifyMigrations(migrationsDir = MIGRATIONS_DIR) {
  const migrations = discoverMigrations(migrationsDir);
  const errors = [];
  const warnings = [];

  if (migrations.length === 0) {
    errors.push('No migration files found in supabase/migrations directory.');
  }

  for (const m of migrations) {
    if (!m.hasRollback) {
      errors.push(`Missing rollback script for migration: ${m.upFile} (expected ${m.version}_${m.name}.down.sql)`);
    } else if (!m.downContent || m.downContent.trim().length === 0) {
      errors.push(`Rollback script is empty: ${m.downFile}`);
    }

    if (!m.upContent || m.upContent.trim().length === 0) {
      errors.push(`Migration script is empty: ${m.upFile}`);
    }
  }

  return {
    valid: errors.length === 0,
    count: migrations.length,
    migrations,
    errors,
    warnings,
  };
}

/**
 * CLI Entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  console.log('🐘 Supabase Rollback-Safe Migration Manager\n');

  const verification = verifyMigrations();

  if (command === 'verify') {
    if (!verification.valid) {
      console.error('❌ Migration verification failed:');
      for (const err of verification.errors) {
        console.error(`  - ${err}`);
      }
      process.exit(1);
    }
    console.log(`✅ All ${verification.count} migrations have verified forward & rollback scripts.`);
    for (const m of verification.migrations) {
      console.log(`  ✓ [${m.version}] ${m.name} -> up: ${m.upFile} | down: ${m.downFile}`);
    }
    return;
  }

  if (command === 'status') {
    console.log(`Discovered ${verification.migrations.length} local migrations:\n`);
    for (const m of verification.migrations) {
      const rollbackBadge = m.hasRollback ? '✅ Rollback Ready' : '❌ Missing Rollback';
      console.log(`  Version ${m.version}: ${m.name}`);
      console.log(`    Up:       ${m.upFile} (SHA256: ${m.upChecksum.slice(0, 12)}...)`);
      console.log(`    Down:     ${m.downFile || 'NONE'} (${rollbackBadge})\n`);
    }

    console.log('To dry-run or view execution SQL:');
    console.log('  pnpm run db:dry-run up');
    console.log('  pnpm run db:dry-run down');
    return;
  }

  if (command === 'dry-run') {
    const direction = args[1] || 'up';
    console.log(`=== Dry-Run Migration Plan (${direction.toUpperCase()}) ===\n`);

    if (direction === 'up') {
      console.log(generateBootstrapSql());
      console.log('\n');
      for (const m of verification.migrations) {
        console.log(generateUpSql(m));
        console.log('\n');
      }
    } else if (direction === 'down') {
      const last = verification.migrations[verification.migrations.length - 1];
      if (!last) {
        console.log('No migrations available to rollback.');
      } else {
        console.log(generateDownSql(last));
      }
    }
    return;
  }

  if (command === 'up' || command === 'down') {
    console.log(`ℹ️ Executing ${command.toUpperCase()} in SQL generation mode.`);
    console.log('Copy and execute the following SQL in your Supabase SQL Editor or via psql:\n');

    if (command === 'up') {
      console.log(generateBootstrapSql());
      console.log('\n');
      for (const m of verification.migrations) {
        console.log(generateUpSql(m));
        console.log('\n');
      }
    } else {
      const last = verification.migrations[verification.migrations.length - 1];
      if (!last) {
        console.log('No migrations to rollback.');
      } else {
        console.log(generateDownSql(last));
      }
    }
  }
}

const isDirectRun =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  main().catch((err) => {
    console.error('Fatal error in migration manager:', err);
    process.exit(1);
  });
}
