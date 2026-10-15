import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileAsync } from '../../utils/exec';

const repoRoot = join(import.meta.dirname, '../../..');

const testDatabaseUrl = (): string => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const composed = Bun.spawnSync(
    [
      'bash',
      'scripts/deployment/with-env.sh',
      'test',
      'api',
      'bash',
      '-c',
      'printf %s "$DATABASE_URL"',
    ],
    { cwd: repoRoot, stdout: 'pipe', stderr: 'pipe' },
  );
  const url = composed.stdout.toString();
  if (!url) throw new Error('No test DATABASE_URL: .env.test is missing or with-env.sh failed');
  return url;
};

const adminUrl = testDatabaseUrl();

const suffix = Date.now().toString(36);
const databaseNames = { prod: `launch_prod_${suffix}`, staging: `launch_staging_${suffix}` };
const databaseUrl = (name: string) => {
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return url.toString();
};
const databaseUrls: Record<string, string> = {
  prod: databaseUrl(databaseNames.prod),
  staging: databaseUrl(databaseNames.staging),
};

mock.module('../infisicalSetup', () => ({
  getSecretAsync: async (_key: string, options: { environment: string }) =>
    databaseUrls[options.environment],
}));

const { baselineDeployedDatabases } = await import('../baselineDeployedDatabases');

const migrationsDir = join(repoRoot, 'packages/db/prisma/migrations');
const migrationsExisted = existsSync(migrationsDir);
const admin = new Bun.SQL(adminUrl);

const prisma = (args: string[], url: string) =>
  execFileAsync('bun', ['run', '--cwd', 'packages/db', 'prisma', ...args], {
    encoding: 'utf-8',
    env: { ...process.env, DATABASE_URL: url },
  });

const appliedMigrations = async (url: string) => {
  const db = new Bun.SQL(url);
  try {
    const rows = await db`SELECT migration_name FROM _prisma_migrations`;
    return rows.map((row: { migration_name: string }) => row.migration_name);
  } finally {
    await db.close();
  }
};

const config = (stagingEnabled: boolean) => ({
  features: { staging: { enabled: stagingEnabled } },
  infisical: { projectId: 'test-project' },
});

beforeAll(async () => {
  for (const name of Object.values(databaseNames)) await admin.unsafe(`CREATE DATABASE "${name}"`);
  await prisma(['db', 'push'], databaseUrls.prod);
}, 60_000);

afterAll(async () => {
  for (const name of Object.values(databaseNames)) {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  }
  await admin.close();
  if (!migrationsExisted) rmSync(migrationsDir, { recursive: true, force: true });
}, 60_000);

describe('baselineDeployedDatabases', () => {
  test('refuses a deployed database that differs from the schema, and records nothing', async () => {
    await expect(baselineDeployedDatabases(config(true))).rejects.toThrow(
      'The staging database differs from prisma/schema',
    );
    expect(
      await admin`SELECT 1 FROM pg_database WHERE datname = ${databaseNames.prod}`,
    ).toHaveLength(1);
    await expect(appliedMigrations(databaseUrls.prod)).rejects.toThrow();
  }, 60_000);

  test('creates 0_init and records it as applied on a pushed database, idempotently', async () => {
    await baselineDeployedDatabases(config(false));
    await baselineDeployedDatabases(config(false));

    expect(existsSync(join(migrationsDir, '0_init/migration.sql'))).toBe(true);
    expect(await appliedMigrations(databaseUrls.prod)).toEqual(['0_init']);

    const deploy = await prisma(['migrate', 'deploy'], databaseUrls.prod);
    expect(deploy.stdout).toContain('No pending migrations to apply');
  }, 60_000);

  test('a database created after launch builds from the baseline', async () => {
    const deploy = await prisma(['migrate', 'deploy'], databaseUrls.staging);
    expect(deploy.stdout).toContain('All migrations have been successfully applied');
    await expect(
      prisma(
        [
          'migrate',
          'diff',
          '--from-config-datasource',
          '--to-schema',
          'prisma/schema',
          '--exit-code',
        ],
        databaseUrls.staging,
      ),
    ).resolves.toBeDefined();
  }, 60_000);
});
