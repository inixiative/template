/**
 * @atlas
 * @kind script
 * @partOf infrastructure:prisma
 * @uses none
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const BASELINE_MIGRATION = '0_init';

const packageRoot = join(import.meta.dirname, '..');
const migrationsDir = join(packageRoot, 'prisma/migrations');
const baselineDir = join(migrationsDir, BASELINE_MIGRATION);

const existingMigrations = () =>
  existsSync(migrationsDir)
    ? readdirSync(migrationsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    : [];

export const createBaselineMigration = async (): Promise<'created' | 'exists'> => {
  const migrations = existingMigrations().map((entry) => entry.name);
  if (migrations.length === 1 && migrations[0] === BASELINE_MIGRATION) return 'exists';
  if (migrations.length > 0) {
    throw new Error(
      `prisma/migrations already holds ${migrations.join(', ')}; a baseline is only created once, before any migration`,
    );
  }

  const diff = Bun.spawnSync(
    [
      'bun',
      'run',
      'prisma',
      'migrate',
      'diff',
      '--from-empty',
      '--to-schema',
      'prisma/schema',
      '--script',
    ],
    { cwd: packageRoot, stdout: 'pipe', stderr: 'pipe' },
  );
  if (diff.exitCode !== 0) throw new Error(`prisma migrate diff failed: ${diff.stderr.toString()}`);

  mkdirSync(baselineDir, { recursive: true });
  writeFileSync(join(baselineDir, 'migration.sql'), diff.stdout.toString());
  writeFileSync(join(migrationsDir, 'migration_lock.toml'), 'provider = "postgresql"\n');
  return 'created';
};

if (import.meta.main) {
  const result = await createBaselineMigration();
  console.log(
    result === 'created'
      ? `Created prisma/migrations/${BASELINE_MIGRATION}; commit it with the launch.`
      : `prisma/migrations/${BASELINE_MIGRATION} already exists.`,
  );
}
