#!/usr/bin/env bun
/**
 * Runs the full check pipeline with zero duplicate codegen and parallel DB vs CPU tracks:
 *   Stage 1 (serial):   check:setup (codegen once) + pretest (push test DB schema once)
 *   Stage 2 (parallel):
 *     - DB track:  packages/db test -> packages/email test -> sharded apps/api test
 *     - CPU track: lint -> typecheck -> non-DB package tests -> test:fe:run -> build -> ci-rules
 */
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '../..');

type Step = {
  label: string;
  cmd: string[];
};

const activeProcs = new Set<Bun.Subprocess>();
let shuttingDown = false;

const forwardSignal = async (code: number) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const proc of activeProcs) {
    try {
      proc.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
  await Promise.allSettled([...activeProcs].map((proc) => proc.exited));
  process.exit(code);
};

process.on('SIGINT', () => void forwardSignal(130));
process.on('SIGTERM', () => void forwardSignal(143));

const runStep = async (
  step: Step,
  bufferOutput: boolean,
): Promise<{ ok: boolean; output: string; elapsedSec: string }> => {
  const startedAt = Date.now();
  const proc = Bun.spawn(step.cmd, {
    cwd: REPO_ROOT,
    stdin: 'ignore',
    stdout: bufferOutput ? 'pipe' : 'inherit',
    stderr: bufferOutput ? 'pipe' : 'inherit',
    env: process.env,
  });
  activeProcs.add(proc);

  try {
    if (!bufferOutput) {
      const code = await proc.exited;
      return {
        ok: code === 0,
        output: '',
        elapsedSec: ((Date.now() - startedAt) / 1000).toFixed(1),
      };
    }

    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return {
      ok: code === 0,
      output: [stdout.trim(), stderr.trim()].filter(Boolean).join('\n'),
      elapsedSec: ((Date.now() - startedAt) / 1000).toFixed(1),
    };
  } finally {
    activeProcs.delete(proc);
  }
};

const runTrack = async (
  trackName: string,
  steps: Step[],
  bufferOutput: boolean,
): Promise<boolean> => {
  for (const step of steps) {
    if (shuttingDown) return false;
    const result = await runStep(step, bufferOutput);
    if (shuttingDown) return false;
    if (!result.ok) {
      console.error(`\n[check:all] ${trackName} FAILED at "${step.label}" (${result.elapsedSec}s)`);
      if (result.output) console.error(result.output);
      return false;
    }
    console.log(`[check:all] ${trackName} ✓ ${step.label} (${result.elapsedSec}s)`);
  }
  return true;
};

const startedAt = Date.now();

// Stage 1: codegen once + push test schema once.
const setupOk = await runTrack(
  'setup',
  [
    { label: 'check:setup', cmd: ['bun', 'run', 'check:setup'] },
    { label: 'pretest', cmd: ['bun', 'run', 'pretest'] },
  ],
  false,
);
if (shuttingDown) {
  await new Promise(() => {});
}
if (!setupOk) process.exit(1);

// Stage 2: run DB-bound tests alongside CPU-only lint/typecheck/unit/fe/build/ci-rules.
const dbTrack: Step[] = [
  { label: 'packages/db test', cmd: ['bun', 'run', '--cwd', 'packages/db', 'test'] },
  { label: 'packages/email test', cmd: ['bun', 'run', '--cwd', 'packages/email', 'test'] },
  { label: 'apps/api test (sharded)', cmd: ['bun', 'run', '--cwd', 'apps/api', 'test'] },
];

const cpuTrack: Step[] = [
  { label: 'lint', cmd: ['bun', 'run', 'lint'] },
  { label: 'typecheck', cmd: ['bun', 'run', 'typecheck'] },
  {
    label: 'packages/permissions test',
    cmd: ['bun', 'run', '--cwd', 'packages/permissions', 'test'],
  },
  { label: 'test:fe:run', cmd: ['bun', 'run', 'test:fe:run'] },
  { label: 'build', cmd: ['bun', 'run', 'build'] },
  { label: 'ci-rules', cmd: ['bash', 'scripts/ci/run-ci-rules.sh'] },
];

const [dbOk, cpuOk] = await Promise.all([
  runTrack('db-track', dbTrack, false),
  runTrack('cpu-track', cpuTrack, true),
]);

if (shuttingDown) {
  await new Promise(() => {});
}

const totalSec = ((Date.now() - startedAt) / 1000).toFixed(1);
if (!dbOk || !cpuOk) {
  console.error(`[check:all] FAILED in ${totalSec}s`);
  process.exit(1);
}

console.log(`[check:all] ALL PASSED in ${totalSec}s`);
