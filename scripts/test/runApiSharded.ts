#!/usr/bin/env bun
/**
 * Runs `apps/api` tests in parallel across N isolated Postgres shard databases cloned from the
 * already-pushed test database (`CREATE DATABASE ... TEMPLATE ...`).
 *
 * - Passing explicit file/filter args (or `API_TEST_SHARDS=1`) falls back to single-process
 *   `bun test --max-concurrency=1` against the base test database.
 * - Redis in test mode is process-local `ioredis-mock`, so per-shard Postgres DBs give full
 *   isolation without cross-shard interference.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { SQL } from 'bun';

const REPO_ROOT = resolve(import.meta.dir, '../..');
const API_DIR = join(REPO_ROOT, 'apps/api');
const DEFAULT_SHARDS = 3;
const MAX_SHARDS = 6;
const DEFAULT_SHARD_POOL_MAX = '6';

const extraArgs = process.argv.slice(2);

const runDirect = async (args: string[]): Promise<number> => {
  const proc = Bun.spawn(['bun', 'test', '--max-concurrency=1', '--cwd', API_DIR, ...args], {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  });
  let signalCode: number | null = null;
  const forward = (code: number) => {
    signalCode = code;
    try {
      proc.kill('SIGTERM');
    } catch {
      // ignore
    }
  };
  process.on('SIGINT', () => forward(130));
  process.on('SIGTERM', () => forward(143));
  const code = await proc.exited;
  return signalCode ?? code;
};

const requestedShards = (() => {
  const raw = process.env.API_TEST_SHARDS;
  if (raw === undefined || raw.trim() === '') return DEFAULT_SHARDS;
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, MAX_SHARDS);
})();

if (extraArgs.length > 0 || requestedShards <= 1) {
  process.exit(await runDirect(extraArgs.length > 0 ? extraArgs : ['src/', 'tests/']));
}

const rawDatabaseUrl = process.env.DATABASE_URL;
if (!rawDatabaseUrl) {
  console.error('[api:test] DATABASE_URL is not set');
  process.exit(1);
}

const baseUrl = new URL(rawDatabaseUrl);
const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname);
const hasHostOverrideParam = [...baseUrl.searchParams.keys()].some((key) =>
  ['host', 'hostaddr', 'port', 'dbname', 'service'].includes(key.toLowerCase()),
);
const baseDbName = decodeURIComponent(baseUrl.pathname.replace(/^\//, ''));

if (
  !['postgres:', 'postgresql:'].includes(baseUrl.protocol) ||
  !isLoopback ||
  hasHostOverrideParam ||
  !baseDbName.includes('test')
) {
  console.error(
    `[api:test] refusing to clone non-local or non-test database (${baseUrl.hostname}/${baseDbName})`,
  );
  process.exit(1);
}

const collectTestFiles = (dir: string): { path: string; size: number }[] => {
  const results: { path: string; size: number }[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'generated') {
        continue;
      }
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && /\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
        results.push({ path: relative(API_DIR, fullPath), size: statSync(fullPath).size });
      }
    }
  };
  walk(dir);
  return results;
};

const allTestFiles = [
  ...collectTestFiles(join(API_DIR, 'src')),
  ...collectTestFiles(join(API_DIR, 'tests')),
].sort((a, b) => b.size - a.size);

if (allTestFiles.length === 0) {
  console.error('[api:test] no test files found under apps/api/{src,tests}');
  process.exit(1);
}

const shardCount = Math.min(requestedShards, allTestFiles.length);
// Greedy bin-packing by file size keeps shard runtimes closely balanced.
const shardBuckets: { files: string[]; bytes: number }[] = Array.from(
  { length: shardCount },
  () => ({ files: [], bytes: 0 }),
);
for (const file of allTestFiles) {
  let lightest = shardBuckets[0];
  for (const bucket of shardBuckets) {
    if (bucket.bytes < lightest.bytes) lightest = bucket;
  }
  lightest.files.push(file.path);
  lightest.bytes += file.size;
}

const adminUrl = new URL(rawDatabaseUrl);
adminUrl.pathname = '/postgres';
const shardDbNames = shardBuckets.map((_, index) => `${baseDbName}_s${index}`);

const quoteIdent = (ident: string): string => `"${ident.replace(/"/g, '""')}"`;

const waitForZeroConnections = async (sql: SQL, dbName: string, timeoutMs = 5_000) => {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    await sql.unsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName],
    );
    const rows = await sql.unsafe<{ count: string }[]>(
      `SELECT count(*)::text AS count FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName],
    );
    if (Number(rows[0]?.count ?? '0') === 0 || Date.now() >= deadline) return;
    await Bun.sleep(50);
  }
};

const dropMatchingShardDatabases = async (sql: SQL) => {
  const existing = new Set<string>(shardDbNames);
  try {
    const escapedPrefix = `${baseDbName.replace(/[\\%_]/g, '\\$&')}_s%`;
    const rows = await sql.unsafe<{ datname: string }[]>(
      `SELECT datname FROM pg_database WHERE datname LIKE $1 ESCAPE '\\'`,
      [escapedPrefix],
    );
    for (const row of rows) {
      if (/^.+_s\d+$/.test(row.datname)) existing.add(row.datname);
    }
  } catch {
    // Fall back to known shardDbNames.
  }

  for (const shardDb of existing) {
    try {
      await sql.unsafe(`DROP DATABASE IF EXISTS ${quoteIdent(shardDb)} WITH (FORCE)`);
    } catch {
      // Best-effort teardown so cleanup never masks test results.
    }
  }
};

const adminSql = new SQL(adminUrl.toString());
const runningProcs: Bun.Subprocess[] = [];
let signalExitCode: number | null = null;
let teardownPromise: Promise<void> | null = null;

const teardown = () => {
  if (!teardownPromise) {
    teardownPromise = (async () => {
      await dropMatchingShardDatabases(adminSql);
      await adminSql.close();
    })();
  }
  return teardownPromise;
};

const handleSignal = async (code: number) => {
  if (signalExitCode !== null) return;
  signalExitCode = code;
  for (const proc of runningProcs) {
    try {
      proc.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
  await Promise.allSettled(runningProcs.map((proc) => proc.exited));
  await teardown();
  process.exit(code);
};

process.on('SIGINT', () => void handleSignal(130));
process.on('SIGTERM', () => void handleSignal(143));

const startedAt = Date.now();
let exitCode = 0;

try {
  const cloneStartedAt = Date.now();
  await dropMatchingShardDatabases(adminSql);
  await waitForZeroConnections(adminSql, baseDbName);
  for (const shardDb of shardDbNames) {
    if (signalExitCode !== null) break;
    await adminSql.unsafe(
      `CREATE DATABASE ${quoteIdent(shardDb)} TEMPLATE ${quoteIdent(baseDbName)}`,
    );
  }
  if (signalExitCode !== null) {
    await teardown();
    process.exit(signalExitCode);
  }
  console.log(
    `[api:test] Cloned ${shardCount} shard DBs from ${baseDbName} in ${Date.now() - cloneStartedAt}ms (${allTestFiles.length} test files)`,
  );

  const shardResults = await Promise.all(
    shardBuckets.map(async (bucket, index) => {
      const shardDb = shardDbNames[index];
      const shardUrl = new URL(rawDatabaseUrl);
      shardUrl.pathname = `/${shardDb}`;
      const shardStart = Date.now();

      const proc = Bun.spawn(
        ['bun', 'test', '--max-concurrency=1', '--cwd', API_DIR, ...bucket.files],
        {
          stdin: 'ignore',
          stdout: 'pipe',
          stderr: 'pipe',
          env: {
            ...process.env,
            DATABASE_URL: shardUrl.toString(),
            DB_POOL_MAX: process.env.DB_POOL_MAX || DEFAULT_SHARD_POOL_MAX,
          },
        },
      );
      runningProcs.push(proc);

      const [stdout, stderr, code] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      if (signalExitCode !== null) {
        return { index, code, elapsedSec: '0.0' };
      }

      const elapsedSec = ((Date.now() - shardStart) / 1000).toFixed(1);
      const summaryLine =
        `${stdout}\n${stderr}`
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => /^Ran \d+ tests across \d+ files/.test(line))
          .pop() ?? `${bucket.files.length} files`;

      if (code === 0) {
        console.log(
          `[api:test] shard ${index + 1}/${shardCount} PASSED (${elapsedSec}s) — ${summaryLine}`,
        );
      } else {
        console.error(
          `[api:test] shard ${index + 1}/${shardCount} FAILED (exit ${code}, ${elapsedSec}s)`,
        );
        if (stdout.trim()) console.error(stdout);
        if (stderr.trim()) console.error(stderr);
      }

      return { index, code, elapsedSec };
    }),
  );

  if (signalExitCode === null) {
    const failed = shardResults.filter((result) => result.code !== 0);
    const totalSec = ((Date.now() - startedAt) / 1000).toFixed(1);
    if (failed.length > 0) {
      console.error(`[api:test] ${failed.length}/${shardCount} shards failed in ${totalSec}s`);
      exitCode = 1;
    } else {
      console.log(
        `[api:test] All ${shardCount} shards passed (${allTestFiles.length} files) in ${totalSec}s`,
      );
    }
  }
} finally {
  if (signalExitCode === null) {
    await teardown();
  }
}

if (signalExitCode === null) {
  process.exit(exitCode);
}
