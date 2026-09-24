import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileSessionState, guard, landingsIn, registeredWorktrees, type SessionState } from '../bashMainCheckoutGuard';

const HOOKS_DIR = resolve(import.meta.dir, '..');
const SESSION = 'session-a';

let sandbox: string;
let mainRoot: string;
let worktreeRoot: string;
let foreignWorktree: string;
let state: SessionState;

const git = (...args: string[]) => {
  const result = Bun.spawnSync(['git', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null',
      GIT_AUTHOR_NAME: 'guard-test',
      GIT_AUTHOR_EMAIL: 'guard@test',
      GIT_COMMITTER_NAME: 'guard-test',
      GIT_COMMITTER_EMAIL: 'guard@test',
    },
  });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
};

const bash = (command: string, cwd: string, sessionId = SESSION, agentId?: string) => ({
  hook_event_name: 'PreToolUse',
  session_id: sessionId,
  agent_id: agentId,
  tool_name: 'Bash',
  cwd,
  tool_input: { command },
});

const visit = (cwd: string, sessionId = SESSION) => guard(bash('ls', cwd, sessionId), state);
const fromMain = (command: string) => guard(bash(command, mainRoot), state);
const isMutating = (command: string) => landingsIn(command, mainRoot).length > 0;

beforeAll(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'main-checkout-guard-')));
  mainRoot = join(sandbox, 'repo');
  git('init', '-q', '-b', 'main', mainRoot);
  git('-C', mainRoot, 'commit', '-q', '--allow-empty', '-m', 'init');
  mkdirSync(join(mainRoot, 'apps/api'), { recursive: true });
  worktreeRoot = join(mainRoot, '.worktrees/FEAT-1234');
  git('-C', mainRoot, 'worktree', 'add', '-q', worktreeRoot, '-b', 'FEAT-1234');
  mkdirSync(join(worktreeRoot, 'apps/api'), { recursive: true });

  const foreignRoot = join(sandbox, 'other-repo');
  git('init', '-q', '-b', 'main', foreignRoot);
  git('-C', foreignRoot, 'commit', '-q', '--allow-empty', '-m', 'init');
  foreignWorktree = join(foreignRoot, '.worktrees/OTHER-1');
  git('-C', foreignRoot, 'worktree', 'add', '-q', foreignWorktree, '-b', 'OTHER-1');
});

beforeEach(() => {
  state = fileSessionState(mkdtempSync(join(sandbox, 'state-')));
});

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('landingsIn', () => {
  test('the guarded set', () => {
    for (const command of [
      'bun add left-pad',
      'bun a left-pad',
      'bun remove left-pad',
      'bun rm left-pad',
      'bun update',
      'bun install left-pad',
      'bun i -d left-pad',
      'git commit -m x',
      'git --no-pager push',
      'git -c core.editor=true rebase origin/main',
      'git merge feature',
      'git cherry-pick abc',
      'git revert abc',
      'git am patch.mbox',
      'bunx prisma migrate dev',
      'bun x prisma migrate dev',
      'bun run db:migrate',
      'bun run --cwd packages/db db:migrate',
      'rtk git push',
      'FOO=1 git commit -m x',
      'git add -A && git push origin HEAD',
      'bun install; git commit -m x',
      '(git push)',
      'bun run --filter @template/db db:migrate',
    ]) {
      expect(isMutating(command), command).toBe(true);
    }
  });

  test('outside the set', () => {
    for (const command of [
      'bun install',
      'bun i --frozen-lockfile',
      'bun run test',
      'bun run db:push:dev',
      'git status',
      'git checkout feature',
      'git switch -c feature',
      'git pull',
      'git worktree list',
      'echo git push',
      'bun install --filter api',
      'bun i --linker isolated',
    ]) {
      expect(isMutating(command), command).toBe(false);
    }
  });

  test('quoted strings and heredoc bodies are text, not commands', () => {
    expect(landingsIn('git commit -m "docs: git worktree add is denied; use the scripts"', mainRoot)).toEqual([
      expect.objectContaining({
        command: 'git commit -m "docs: git worktree add is denied; use the scripts"',
        lifecycle: false,
      }),
    ]);
    const heredocCommit =
      "git commit -F - <<'EOF'\nguard\n\ngit worktree add is denied\nbun add is denied\nEOF\ngit status";
    expect(landingsIn(heredocCommit, mainRoot).map((landing) => landing.lifecycle)).toEqual([false]);
    const spaced = join(sandbox, 'dir with space');
    mkdirSync(spaced, { recursive: true });
    expect(landingsIn(`cd "${spaced}" && git push`, mainRoot)[0]?.directory).toBe(spaced);
  });

  test('git worktree add/remove/move/prune are lifecycle landings', () => {
    for (const command of [
      'git worktree add ../x',
      'git worktree remove x',
      'git worktree move x y',
      'git worktree prune',
    ]) {
      expect(landingsIn(command, mainRoot)[0]?.lifecycle, command).toBe(true);
    }
  });

  test('cd, git -C and bun --cwd move the effective directory; an absolute path, and moves relative to it, are explicit', () => {
    const land = (command: string) => landingsIn(command, mainRoot)[0];
    expect(land(`cd ${worktreeRoot} && git push`)).toMatchObject({ directory: worktreeRoot, absolute: true });
    expect(land(`git -C ${worktreeRoot} push`)).toMatchObject({ directory: worktreeRoot, absolute: true });
    expect(land(`bun --cwd=${worktreeRoot} add x`)).toMatchObject({ directory: worktreeRoot, absolute: true });
    expect(land('cd apps/api && bun add x')).toMatchObject({ directory: join(mainRoot, 'apps/api'), absolute: false });
    expect(land(`cd ${mainRoot} && cd apps/api && git push`)).toMatchObject({ absolute: true });
    expect(land(`cd ${mainRoot} && bun run --cwd apps/api db:migrate`)).toMatchObject({ absolute: true });
    expect(land(`cd ${mainRoot} && git push`)).toMatchObject({ directory: mainRoot, absolute: true });
  });

  test('a cd inside ( ) does not leak past the subshell', () => {
    expect(landingsIn(`(cd ${worktreeRoot} && bun test) && git commit -m x`, mainRoot)[0]?.directory).toBe(mainRoot);
    expect(landingsIn(`(cd ${worktreeRoot} && git commit -m x)`, mainRoot)[0]?.directory).toBe(worktreeRoot);
  });

  test('a cd target with a variable or substitution is unknown, not a relative path', () => {
    expect(landingsIn('cd "$WT" && git commit -m x', mainRoot)[0]?.directory).toBeUndefined();
    expect(landingsIn('cd $(git rev-parse --show-toplevel) && git push', mainRoot)[0]?.directory).toBeUndefined();
  });
});

describe('registeredWorktrees', () => {
  test('lists linked worktrees, not the main checkout', () => {
    expect(registeredWorktrees(mainRoot)).toEqual([realpathSync(worktreeRoot)]);
  });
});

describe('guard: drift back to the main checkout', () => {
  test('a session that never entered a worktree is not touched', () => {
    expect(fromMain('git push')).toBeUndefined();
    expect(fromMain('bun add left-pad')).toBeUndefined();
  });

  test('after the session worked in a worktree, a mutation landing in main is denied and names the worktree', () => {
    visit(worktreeRoot);
    const reason = fromMain('git commit -m x');
    expect(reason).toContain(worktreeRoot);
    expect(reason).toContain(`cd ${worktreeRoot} && git commit -m x`);
    expect(fromMain('cd apps/api && bun add x')).toBeDefined();
  });

  test('fires whatever branch the main checkout is on', () => {
    git('-C', mainRoot, 'checkout', '-q', '-b', 'some-feature');
    try {
      visit(worktreeRoot);
      expect(fromMain('git push')).toBeDefined();
    } finally {
      git('-C', mainRoot, 'checkout', '-q', 'main');
    }
  });

  test('targeting the worktree, or naming main by its absolute path, is allowed', () => {
    visit(worktreeRoot);
    expect(fromMain(`cd ${worktreeRoot} && git push`)).toBeUndefined();
    expect(fromMain(`git -C ${worktreeRoot} commit -m x`)).toBeUndefined();
    expect(fromMain(`cd ${mainRoot} && git push`)).toBeUndefined();
    expect(fromMain(`git -C ${mainRoot} push`)).toBeUndefined();
    expect(fromMain('git status')).toBeUndefined();
  });

  test('commands run from inside the worktree are allowed; a relative cd out of it into main is denied', () => {
    visit(worktreeRoot);
    expect(guard(bash('git commit -m x', worktreeRoot), state)).toBeUndefined();
    expect(guard(bash('cd ../.. && git push', worktreeRoot), state)).toBeDefined();
  });

  test('a removed worktree does not arm the guard', () => {
    const doomed = join(mainRoot, '.worktrees/DOOMED');
    git('-C', mainRoot, 'worktree', 'add', '-q', doomed, '-b', 'DOOMED');
    visit(doomed);
    git('-C', mainRoot, 'worktree', 'remove', doomed);
    expect(fromMain('git push')).toBeUndefined();
  });

  test('another repository’s worktree neither arms the guard nor replaces this repository’s worktree', () => {
    visit(foreignWorktree);
    expect(fromMain('git push')).toBeUndefined();
    visit(worktreeRoot);
    visit(foreignWorktree);
    expect(fromMain('git push')).toContain(worktreeRoot);
  });

  test('state is per session and per subagent', () => {
    visit(worktreeRoot, 'session-b');
    expect(fromMain('git push')).toBeUndefined();
    guard(bash('ls', worktreeRoot, SESSION, 'agent-1'), state);
    expect(fromMain('git push')).toBeUndefined();
    expect(guard(bash('git push', mainRoot, SESSION, 'agent-1'), state)).toContain(worktreeRoot);
  });
});

describe('guard: worktree lifecycle goes through the scripts', () => {
  test('git worktree add/remove is denied in every session and every checkout', () => {
    expect(fromMain('git worktree add .worktrees/x -b x')).toContain('bun run worktree:create');
    expect(guard(bash('git worktree remove .', worktreeRoot, 'fresh'), state)).toContain('bun run worktree:destroy');
    expect(fromMain('git worktree list')).toBeUndefined();
  });
});

describe('session state', () => {
  test('prune drops entries older than the cutoff', () => {
    const dir = mkdtempSync(join(sandbox, 'prune-'));
    const pruned = fileSessionState(dir);
    pruned.rememberWorktree('old', worktreeRoot);
    const [oldFile] = readdirSync(dir);
    pruned.rememberWorktree('fresh', worktreeRoot);
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    utimesSync(join(dir, oldFile), twoDaysAgo, twoDaysAgo);
    pruned.prune(24 * 60 * 60 * 1000);
    expect(readdirSync(dir).length).toBe(1);
  });
});

describe('hook binary', () => {
  const run = (input: Record<string, unknown>, stateDir: string) => {
    const result = Bun.spawnSync(['bun', join(HOOKS_DIR, 'bashMainCheckoutGuard.ts')], {
      stdin: Buffer.from(JSON.stringify(input)),
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, WORKTREE_GUARD_STATE_DIR: stateDir },
    });
    expect(result.exitCode).toBe(0);
    return { stdout: result.stdout.toString().trim(), stderr: result.stderr.toString() };
  };

  test('records on SessionStart, prunes stale state, emits a PreToolUse deny, and is silent otherwise', () => {
    const stateDir = mkdtempSync(join(sandbox, 'bin-state-'));
    writeFileSync(join(stateDir, 'stale'), `${worktreeRoot}\n`);
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    utimesSync(join(stateDir, 'stale'), twoDaysAgo, twoDaysAgo);
    expect(run(bash('git push', mainRoot), stateDir).stdout).toBe('');
    expect(run({ hook_event_name: 'SessionStart', session_id: SESSION, cwd: worktreeRoot }, stateDir).stdout).toBe('');
    expect(existsSync(join(stateDir, 'stale'))).toBe(false);
    const denied = JSON.parse(run(bash('git push', mainRoot), stateDir).stdout);
    expect(denied.hookSpecificOutput).toMatchObject({ hookEventName: 'PreToolUse', permissionDecision: 'deny' });
    expect(denied.hookSpecificOutput.permissionDecisionReason).toContain(worktreeRoot);
    expect(run(bash(`cd ${worktreeRoot} && git push`, mainRoot), stateDir).stdout).toBe('');
  });

  test('fails open with one stderr line when state cannot be written', () => {
    const blocker = join(sandbox, 'state-as-file');
    writeFileSync(blocker, 'not a directory\n');
    const { stdout, stderr } = run(bash('ls', worktreeRoot), blocker);
    expect(stdout).toBe('');
    expect(stderr.match(/bashMainCheckoutGuard:/g)?.length).toBe(1);
  });
});
