import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileSessionState, guard, MUTATING, type SessionState } from '../bashMainCheckoutGuard';

const HOOKS_DIR = resolve(import.meta.dir, '..');

let sandbox: string;
let mainRoot: string;
let worktreeRoot: string;
let plainDir: string;
let state: SessionState;

const SESSION = 'session-a';

const bash = (command: string, cwd: string, sessionId = SESSION) => ({
  hook_event_name: 'PreToolUse',
  session_id: sessionId,
  tool_name: 'Bash',
  cwd,
  tool_input: { command },
});

const visitWorktree = (sessionId = SESSION) => guard(bash('ls', worktreeRoot, sessionId), state);

const onMain = (head: string, run: () => void) => {
  writeFileSync(join(mainRoot, '.git/HEAD'), `ref: refs/heads/${head}\n`);
  try {
    run();
  } finally {
    writeFileSync(join(mainRoot, '.git/HEAD'), 'ref: refs/heads/main\n');
  }
};

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'main-checkout-guard-'));

  mainRoot = join(sandbox, 'repo');
  mkdirSync(join(mainRoot, '.git/worktrees/FEAT-1234'), { recursive: true });
  writeFileSync(join(mainRoot, '.git/HEAD'), 'ref: refs/heads/main\n');
  mkdirSync(join(mainRoot, 'apps/api'), { recursive: true });

  worktreeRoot = join(mainRoot, '.worktrees/FEAT-1234');
  mkdirSync(join(worktreeRoot, 'apps/api'), { recursive: true });
  writeFileSync(join(worktreeRoot, '.git'), `gitdir: ${mainRoot}/.git/worktrees/FEAT-1234\n`);

  plainDir = join(sandbox, 'not-a-checkout');
  mkdirSync(plainDir, { recursive: true });
});

beforeEach(() => {
  state = fileSessionState(mkdtempSync(join(sandbox, 'state-')));
});

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('MUTATING', () => {
  test('the guarded set, with global options before the subcommand and through command runners', () => {
    for (const command of [
      'bun add left-pad',
      'bun --cwd . add left-pad',
      'bun remove left-pad',
      'bun update',
      'git commit -m x',
      'git -C . commit -m x',
      'git --no-pager push',
      'git -c core.editor=true rebase origin/main',
      'git --git-dir=.git cherry-pick abc',
      'git merge feature',
      'git worktree add ../x',
      'git worktree remove x',
      'git worktree prune',
      'bunx prisma migrate dev',
      'bun run db:migrate',
      'bun run --cwd packages/db db:migrate',
      'bun run prisma migrate dev --name add_thing',
      'git add -A && git push origin HEAD',
      'bun install; git commit -m x',
      'true || git push',
      '(git push)',
    ]) {
      expect(MUTATING.test(command), command).toBe(true);
    }
  });

  test('read-only, routine, and mention-only commands are outside it', () => {
    for (const command of [
      'git status',
      'git pull --ff-only origin main',
      'git -C . log --oneline',
      'git worktree list',
      'bun install',
      'bun run worktree:create main FEAT-9',
      'bun run worktree:destroy FEAT-1234',
      'bun run test',
      'bun run db:push:dev',
      'gh pr comment 1 --body "remember to git push"',
      'echo "then run: bun add left-pad"',
      'cat <<EOF\ngit push\nbun add x\nEOF',
      'rtk git push',
    ]) {
      expect(MUTATING.test(command), command).toBe(false);
    }
  });
});

describe('bashMainCheckoutGuard', () => {
  test('a session that has only ever been in the main checkout is never guarded', () => {
    expect(guard(bash('bun add left-pad', mainRoot), state)).toBeUndefined();
    expect(guard(bash('git commit -m "docs"', mainRoot), state)).toBeUndefined();
    expect(guard(bash('git push origin main', join(mainRoot, 'apps/api')), state)).toBeUndefined();
  });

  test('after the session has been in a worktree, a bare mutation from main is denied and names that worktree', () => {
    visitWorktree();
    const reason = guard(bash('bun add @inixiative/json-rules@2.22.0', mainRoot), state);
    expect(reason).toContain('MAIN checkout');
    expect(reason).toContain(`cd ${worktreeRoot} && bun add @inixiative/json-rules@2.22.0`);
    expect(reason).toContain(`cd ${mainRoot} && bun add @inixiative/json-rules@2.22.0`);
  });

  test('commits, pushes, merges, worktree registry changes, and new migrations are the guarded set', () => {
    visitWorktree();
    expect(guard(bash('git commit -m "wip"', mainRoot), state)).toBeDefined();
    expect(guard(bash('git add -A && git push origin HEAD', mainRoot), state)).toBeDefined();
    expect(guard(bash('git rebase origin/main', mainRoot), state)).toBeDefined();
    expect(guard(bash('git worktree add ../x feature', mainRoot), state)).toBeDefined();
    expect(guard(bash('bun run db:migrate --name add_thing', mainRoot), state)).toBeDefined();
    expect(guard(bash('bunx prisma migrate dev', join(mainRoot, 'apps/api')), state)).toBeDefined();
  });

  test('global options before the subcommand do not bypass the guard', () => {
    visitWorktree();
    expect(guard(bash('git -C . commit -m x', mainRoot), state)).toBeDefined();
    expect(guard(bash('git --no-pager push', mainRoot), state)).toBeDefined();
    expect(guard(bash('bun --cwd . add left-pad', mainRoot), state)).toBeDefined();
  });

  test('an explicit cd into an existing checkout is a deliberate choice, even when it targets main', () => {
    visitWorktree();
    expect(guard(bash(`cd ${mainRoot} && bun add left-pad`, mainRoot), state)).toBeUndefined();
    expect(guard(bash(`cd ${worktreeRoot} && git commit -m x`, mainRoot), state)).toBeUndefined();
    expect(guard(bash(`cd "${worktreeRoot}" && git commit -m x`, mainRoot), state)).toBeUndefined();
    expect(guard(bash(`cd '${worktreeRoot}/apps/api'; git push`, mainRoot), state)).toBeUndefined();
    expect(guard(bash('cd .worktrees/FEAT-1234 && git push', mainRoot), state)).toBeUndefined();
  });

  test('a cd whose target does not exist or is not a checkout does not bypass the guard', () => {
    visitWorktree();
    const missing = guard(bash('cd /does/not/exist; git push', mainRoot), state);
    expect(missing).toContain('/does/not/exist');
    expect(missing).toContain('would run in main anyway');
    expect(guard(bash('cd /bad || git commit -m x', mainRoot), state)).toBeDefined();
    expect(guard(bash(`cd ${plainDir} && git push`, mainRoot), state)).toBeDefined();
    expect(guard(bash('cd "$SOMEWHERE" && git push', mainRoot), state)).toBeDefined();
  });

  test('a relative path into main is not a deliberate choice of main', () => {
    visitWorktree();
    expect(guard(bash('cd . && git push', mainRoot), state)).toBeDefined();
    expect(guard(bash('cd apps/api && bun add left-pad', mainRoot), state)).toBeDefined();
    expect(guard(bash('git -C . commit -m x', mainRoot), state)).toBeDefined();
  });

  test('git -C is honoured like an explicit cd, under the same existence and checkout check', () => {
    visitWorktree();
    expect(guard(bash(`git -C ${worktreeRoot} commit -m x`, mainRoot), state)).toBeUndefined();
    expect(guard(bash('git -C .worktrees/FEAT-1234 commit -m x', mainRoot), state)).toBeUndefined();
    expect(guard(bash(`git -C "${mainRoot}" push`, mainRoot), state)).toBeUndefined();
    expect(guard(bash('git -C /does/not/exist commit -m x', mainRoot), state)).toBeDefined();
    expect(guard(bash(`git -C ${plainDir} push`, mainRoot), state)).toBeDefined();
    expect(guard(bash(`cd ${worktreeRoot} && git -C /does/not/exist push`, mainRoot), state)).toBeDefined();
  });

  test('read-only, routine, and mention-only commands on main pass even after worktree work', () => {
    visitWorktree();
    expect(guard(bash('git status', mainRoot), state)).toBeUndefined();
    expect(guard(bash('git pull --ff-only origin main', mainRoot), state)).toBeUndefined();
    expect(guard(bash('bun install', mainRoot), state)).toBeUndefined();
    expect(guard(bash('bun run worktree:create main FEAT-9', mainRoot), state)).toBeUndefined();
    expect(guard(bash('bun run worktree:destroy FEAT-1234', mainRoot), state)).toBeUndefined();
    expect(guard(bash('bun run test', mainRoot), state)).toBeUndefined();
    expect(guard(bash('gh pr comment 1 --body "remember to git push"', mainRoot), state)).toBeUndefined();
    expect(guard(bash('cat <<EOF\ngit push\nEOF', mainRoot), state)).toBeUndefined();
  });

  test('anything inside a worktree passes and records the worktree for the session', () => {
    expect(guard(bash('git commit -m x', worktreeRoot), state)).toBeUndefined();
    expect(guard(bash('bun add left-pad', join(worktreeRoot, 'apps/api')), state)).toBeUndefined();
    expect(state.lastWorktree(SESSION)).toBe(worktreeRoot);
  });

  test('sessions are independent: another session in main is unaffected by this one visiting a worktree', () => {
    visitWorktree('session-a');
    expect(guard(bash('git commit -m x', mainRoot, 'session-b'), state)).toBeUndefined();
    expect(guard(bash('git commit -m x', mainRoot, 'session-a'), state)).toBeDefined();
  });

  test('a main checkout on a feature branch, or a remembered worktree that no longer exists, is not guarded', () => {
    visitWorktree();
    onMain('hotfix', () => {
      expect(guard(bash('git commit -m x', mainRoot), state)).toBeUndefined();
    });
    expect(guard(bash('git commit -m x', mainRoot), state)).toBeDefined();

    state.rememberWorktree(SESSION, join(mainRoot, '.worktrees/destroyed'));
    expect(guard(bash('git commit -m x', mainRoot), state)).toBeUndefined();
  });

  test('a SessionStart event inside a worktree records it before any Bash call', () => {
    expect(
      guard({ hook_event_name: 'SessionStart', session_id: SESSION, cwd: join(worktreeRoot, 'apps/api') }, state),
    ).toBeUndefined();
    expect(guard(bash('git push', mainRoot), state)).toBeDefined();
  });

  test('the hook binary keeps per-session state, emits a PreToolUse deny, and stays silent otherwise', () => {
    const stateDir = mkdtempSync(join(sandbox, 'bin-state-'));
    const run = (input: Record<string, unknown>) => {
      const result = Bun.spawnSync(['bun', join(HOOKS_DIR, 'bashMainCheckoutGuard.ts')], {
        stdin: Buffer.from(JSON.stringify(input)),
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env, WORKTREE_GUARD_DEBUG: '1', WORKTREE_GUARD_STATE_DIR: stateDir },
      });
      expect(result.exitCode).toBe(0);
      expect(result.stderr.toString()).toBe('');
      return result.stdout.toString().trim();
    };
    expect(run(bash('git push', mainRoot))).toBe('');
    expect(run(bash('ls', worktreeRoot))).toBe('');
    const denied = JSON.parse(run(bash('git push', mainRoot))) as {
      hookSpecificOutput: { hookEventName: string; permissionDecision: string; permissionDecisionReason: string };
    };
    expect(denied.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(denied.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(denied.hookSpecificOutput.permissionDecisionReason).toContain(worktreeRoot);
    expect(run(bash('git status', mainRoot))).toBe('');
    expect(run({ session_id: SESSION, tool_name: 'Read', cwd: mainRoot, tool_input: { file_path: 'x' } })).toBe('');
  });
});
