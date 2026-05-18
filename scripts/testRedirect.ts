// Loaded by the root bunfig.toml when `bun test` runs from the repo root.
// Raw `bun test` from root bypasses the per-workspace bunfigs (which preload
// the env wrapper + Redis/queue mocks). Re-dispatches:
//   bun test                            → bun run test && bun run test:fe
//   bun test apps/<x>/...               → bun run --cwd apps/<x> test
//   bun test packages/ui/...            → bun run --cwd packages/ui test
//   bun test packages/<other>/...       → bun run --cwd apps/api test
//   (packages/db, /permissions, /email, /shared tests run through apps/api)
//
// `__TEST_REDIRECT__=1` is set when re-dispatching so inner `bun test` calls
// from `test:fe` (`bun test --concurrency=1 tests/frontend`) don't loop back.

if (process.env.__TEST_REDIRECT__) {
  // already redirected once; this is the inner workspace invocation — fall through
} else {
  const cwd = process.cwd();
  const raw = process.argv.slice(1).find((a) => a.endsWith('.test.ts') || a.endsWith('.test.tsx'));
  const file = raw?.startsWith(`${cwd}/`) ? raw.slice(cwd.length + 1) : raw;
  const env = { ...process.env, __TEST_REDIRECT__: '1' };

  if (!file) {
    for (const script of ['test', 'test:fe']) {
      const r = Bun.spawnSync({ cmd: ['bun', 'run', script], env, stdio: ['inherit', 'inherit', 'inherit'] });
      if ((r.exitCode ?? 1) !== 0) process.exit(r.exitCode ?? 1);
    }
    process.exit(0);
  }

  const match = file.match(/^(apps|packages)\/([^/]+)\//);
  const workspace =
    match?.[1] === 'apps'
      ? `apps/${match[2]}`
      : match?.[1] === 'packages' && match[2] === 'ui'
        ? 'packages/ui'
        : 'apps/api';

  const result = Bun.spawnSync({
    cmd: ['bun', 'run', '--cwd', workspace, 'test'],
    env,
    stdio: ['inherit', 'inherit', 'inherit'],
  });
  process.exit(result.exitCode ?? 1);
}
