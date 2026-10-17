import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  discoverMigrations,
  calculateChecksum,
  generateBootstrapSql,
  generateUpSql,
  generateDownSql,
  verifyMigrations,
  MIGRATIONS_DIR,
} from '../scripts/migrate-supabase.mjs';

describe('Supabase Rollback-Safe Migrations', () => {
  describe('discoverMigrations', () => {
    it('should discover all forward migrations and match their corresponding rollback scripts', () => {
      const migrations = discoverMigrations(MIGRATIONS_DIR);

      expect(migrations.length).toBeGreaterThanOrEqual(2);

      const m001 = migrations.find((m) => m.version === '001');
      expect(m001).toBeDefined();
      expect(m001?.name).toBe('init_reminders');
      expect(m001?.hasRollback).toBe(true);
      expect(m001?.downFile).toBe('001_init_reminders.down.sql');
      expect(m001?.upContent).toContain('create table if not exists public.reminder_preferences');
      expect(m001?.downContent).toContain('drop table if exists public.reminder_preferences');

      const m002 = migrations.find((m) => m.version === '002');
      expect(m002).toBeDefined();
      expect(m002?.name).toBe('add_reminder_frequency_column');
      expect(m002?.hasRollback).toBe(true);
      expect(m002?.downFile).toBe('002_add_reminder_frequency_column.down.sql');
    });

    it('should calculate unique SHA-256 checksums for migrations', () => {
      const migrations = discoverMigrations(MIGRATIONS_DIR);
      for (const m of migrations) {
        expect(m.upChecksum).toMatch(/^[a-f0-9]{64}$/);
        expect(m.downChecksum).toMatch(/^[a-f0-9]{64}$/);
      }
    });
  });

  describe('verifyMigrations', () => {
    it('should pass verification when every migration has an up and down pair', () => {
      const result = verifyMigrations(MIGRATIONS_DIR);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('generateBootstrapSql', () => {
    it('should create the schema migrations tracking table with proper columns', () => {
      const sql = generateBootstrapSql();

      expect(sql).toContain('create table if not exists public._schema_migrations');
      expect(sql).toContain('version text primary key');
      expect(sql).toContain('checksum text not null');
      expect(sql).toContain('applied_at timestamptz');
    });
  });

  describe('generateUpSql & generateDownSql (Dry-Run Simulation)', () => {
    it('should wrap forward migration in a transaction and record migration state', () => {
      const migrations = discoverMigrations(MIGRATIONS_DIR);
      const m002 = migrations.find((m) => m.version === '002');
      expect(m002).toBeDefined();

      const upSql = generateUpSql(m002!);

      expect(upSql).toMatch(/^-- ============================================================/);
      expect(upSql).toContain('begin;');
      expect(upSql).toContain('add column if not exists reminder_frequency');
      expect(upSql).toContain("insert into public._schema_migrations (version, name, checksum, applied_at)");
      expect(upSql).toContain("values ('002', 'add_reminder_frequency_column'");
      expect(upSql).toContain('commit;');
    });

    it('should wrap rollback migration in a transaction and remove migration state', () => {
      const migrations = discoverMigrations(MIGRATIONS_DIR);
      const m002 = migrations.find((m) => m.version === '002');
      expect(m002).toBeDefined();

      const downSql = generateDownSql(m002!);

      expect(downSql).toMatch(/^-- ============================================================/);
      expect(downSql).toContain('begin;');
      expect(downSql).toContain('drop column if exists reminder_frequency;');
      expect(downSql).toContain("delete from public._schema_migrations where version = '002';");
      expect(downSql).toContain('commit;');
    });

    it('should throw an error when generating rollback for a migration without a down file', () => {
      const mockMigration = {
        version: '999',
        name: 'test_no_down',
        upFile: '999_test.sql',
        upPath: '/tmp/999_test.sql',
        upContent: 'create table foo (id int);',
        upChecksum: 'abc',
        downFile: null,
        downPath: null,
        downContent: null,
        downChecksum: null,
        hasRollback: false,
      };

      expect(() => generateDownSql(mockMigration)).toThrow(
        /does not have a corresponding rollback script/
      );
    });
  });
});
