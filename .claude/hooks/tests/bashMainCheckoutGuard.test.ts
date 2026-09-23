import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  defaultBranch,
  fileSessionState,
  guard,
  isMutating,
  mutationsIn,
  REQUIRE_MAIN_BRANCH,
  type SessionState,
} from '../bashMainCheckoutGuard';

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

const fromMain = (command: string) => guard(bash(command, mainRoot), state);

const withRefs = (head: string, originHead: string, run: () => void) => {
  writeFileSync(join(mainRoot, '.git/HEAD'), `ref: refs/heads/${head}\n`);
  writeFileSync(join(mainRoot, '.git/refs/remotes/origin/HEAD'), `ref: refs/remotes/origin/${originHead}\n`);
  try {
    run();
  } finally {
    writeFileSync(join(mainRoot, '.git/HEAD'), 'ref: refs/heads/main\n');
    writeFileSync(join(mainRoot, '.git/refs/remotes/origin/HEAD'), 'ref: refs/remotes/origin/main\n');
  }
};

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'main-checkout-guard-'));

  mainRoot = join(sandbox, 'repo');
  mkdirSync(join(mainRoot, '.git/worktrees/FEAT-1234'), { recursive: true });
  mkdirSync(join(mainRoot, '.git/refs/remotes/origin'), { recursive: true });
  writeFileSync(join(mainRoot, '.git/HEAD'), 'ref: refs/heads/main\n');
  writeFileSync(join(mainRoot, '.git/refs/remotes/origin/HEAD'), 'ref: refs/remotes/origin/main\n');
  mkdirSync(join(mainRoot, 'apps/api'), { recursive: true });
  mkdirSync(join(mainRoot, 'packages/db'), { recursive: true });

  worktreeRoot = join(mainRoot, '.worktrees/FEAT-1234');
  mkdirSync(join(worktreeRoot, 'apps/api'), { recursive: true });
  mkdirSync(join(worktreeRoot, 'packages/db'), { recursive: true });
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

describe('isMutating', () => {
  test('the guarded set, with global options before the subcommand', () => {
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
      expect(isMutating(command), command).toBe(true);
    }
  });

  test('finding 1: newlines, indentation, comments, and line continuations do not hide a command', () => {
    for (const command of [
      'echo hi\ngit push',
      ' git push',
      '\tgit push',
      '# comment\ngit push',
      'cd /tmp\ngit push',
      'git \\\n push',
      'echo a\r\ngit push',
      'echo a\n\n  bun add x',
    ]) {
      expect(isMutating(command), JSON.stringify(command)).toBe(true);
    }
  });

  test('finding 2: wrappers, env assignments, shell -c, eval, and compound bodies are seen through', () => {
    for (const command of [
      'FOO=1 git push',
      'A=1 B=2 git push',
      'env git push',
      'env -i A=1 git push',
      'command git push',
      'exec git push',
      'nohup git push',
      'timeout 10 git push',
      'timeout -k 5 10 git push',
      'nice -n 5 git push',
      'nice git push',
      'time git push',
      'echo origin | xargs git push',
      'rtk git push',
      'rtk proxy git push',
      'rtk proxy bun add x',
      'bunx prisma migrate dev',
      'bun x prisma migrate dev',
      'npx prisma migrate dev',
      'sh -c "git push"',
      "bash -c 'cd /tmp && git push'",
      'bash -lc "git commit -m x"',
      'eval "git push"',
      "eval 'bun add x'",
      'eval git push',
      '{ git push; }',
      'if true; then git push; fi',
      'for x in a b; do git push; done',
      'while true; do git commit -m x; done',
      'true && { git push; }',
      'if git push; then echo ok; fi',
      '! git push',
    ]) {
      expect(isMutating(command), command).toBe(true);
    }
  });

  test('finding 4: quoted strings and heredoc bodies are never matched', () => {
    for (const command of [
      'gh pr comment 1 --body "fix; git push later"',
      'gh pr comment 1 --body "run bun install && git push"',
      'echo "then; bun add x"',
      "echo 'git push; bun add x'",
      'grep -rn "; git commit" docs/',
      'rg "git commit|git push" .',
      'gh pr create --body "$(cat <<EOF\nx; git push\nEOF\n)"',
      'cat <<EOF\ngit push\nbun add x\nEOF',
      "cat <<'EOF'\ngit push\nEOF",
      'cat <<-EOF\n\tgit push\n\tEOF',
      'cat <<EOF > notes.md\n; git push\nEOF\necho done',
      'git log --grep="git push"',
    ]) {
      expect(isMutating(command), JSON.stringify(command)).toBe(false);
    }
  });

  test('finding 4: non-mutating forms of guarded subcommands', () => {
    for (const command of [
      'git push --dry-run',
      'git push --dry-run origin HEAD',
      'git merge --abort',
      'git rebase --continue',
      'git rebase --quit',
      'git cherry-pick --skip',
      'git worktree list',
      'git worktree prune --dry-run',
      'git commit --dry-run',
      'bun add --dry-run left-pad',
    ]) {
      expect(isMutating(command), command).toBe(false);
    }
  });

  test('finding 14: only the real migrate script names count', () => {
    expect(isMutating('bun run db:migrate')).toBe(true);
    expect(isMutating('bun run db:migrate:anything')).toBe(false);
    expect(isMutating('bun run db:migrate-status')).toBe(false);
    expect(isMutating('bun run db:push:dev')).toBe(false);
    expect(isMutating('bun run db:deploy')).toBe(false);
  });

  test('read-only and routine commands are outside the set', () => {
    for (const command of [
      'git status',
      'git pull --ff-only origin main',
      'git -C . log --oneline',
      'bun install',
      'bun run worktree:create main FEAT-9',
      'bun run worktree:destroy FEAT-1234',
      'bun run test',
      'bun run check',
      'FOO=bar bun run test',
    ]) {
      expect(isMutating(command), command).toBe(false);
    }
  });

  test('a command after a heredoc body is still analysed', () => {
    expect(isMutating('cat <<EOF\nhello\nEOF\ngit push')).toBe(true);
  });
});

describe('mutationsIn: effective directory per segment (finding 3)', () => {
  test('a cd applies to the segments after it, in order', () => {
    expect(mutationsIn(`cd ${worktreeRoot} && git push`, mainRoot).map((m) => m.directory)).toEqual([worktreeRoot]);
    expect(mutationsIn(`cd ${worktreeRoot} && cd .. && git push`, mainRoot).map((m) => m.directory)).toEqual([
      join(mainRoot, '.worktrees'),
    ]);
    expect(mutationsIn(`cd ${worktreeRoot}; cd ${mainRoot}; git push`, mainRoot).map((m) => m.directory)).toEqual([
      mainRoot,
    ]);
    expect(mutationsIn('cd .worktrees/FEAT-1234 && git push', mainRoot).map((m) => m.directory)).toEqual([
      worktreeRoot,
    ]);
    expect(mutationsIn(`cd ${worktreeRoot}\ngit push`, mainRoot).map((m) => m.directory)).toEqual([worktreeRoot]);
  });

  test('git -C and bun --cwd apply only to their own segment', () => {
    expect(mutationsIn(`git -C ${worktreeRoot} status && git push`, mainRoot).map((m) => m.directory)).toEqual([
      mainRoot,
    ]);
    expect(mutationsIn(`git -C ${worktreeRoot} push && git status`, mainRoot).map((m) => m.directory)).toEqual([
      worktreeRoot,
    ]);
    expect(mutationsIn(`cd ${worktreeRoot} && git -C . push`, mainRoot).map((m) => m.directory)).toEqual([
      worktreeRoot,
    ]);
    expect(mutationsIn(`cd ${worktreeRoot} && bun --cwd . add x`, mainRoot).map((m) => m.directory)).toEqual([
      worktreeRoot,
    ]);
    expect(mutationsIn(`bun --cwd ${worktreeRoot}/apps/api add x`, mainRoot).map((m) => m.directory)).toEqual([
      join(worktreeRoot, 'apps/api'),
    ]);
    expect(mutationsIn('bun run --cwd packages/db db:migrate', mainRoot).map((m) => m.directory)).toEqual([
      join(mainRoot, 'packages/db'),
    ]);
  });

  test('unknown targets leave the directory unresolved', () => {
    expect(mutationsIn('cd /does/not/exist; git push', mainRoot)[0].directory).toBeUndefined();
    expect(mutationsIn('cd "$SOMEWHERE" && git push', mainRoot)[0].directory).toBeUndefined();
    expect(mutationsIn('cd - && git push', mainRoot)[0].directory).toBeUndefined();
    expect(mutationsIn('popd && git push', mainRoot)[0].directory).toBeUndefined();
    expect(mutationsIn('git -C /does/not/exist push', mainRoot)[0]).toMatchObject({
      directory: undefined,
      namedTarget: '/does/not/exist',
    });
    expect(mutationsIn(`cd ${worktreeRoot} && git -C /does/not/exist push`, mainRoot)[0].directory).toBeUndefined();
  });

  test('quoted paths resolve like bare ones', () => {
    expect(mutationsIn(`cd "${worktreeRoot}" && git push`, mainRoot)[0].directory).toBe(worktreeRoot);
    expect(mutationsIn(`cd '${worktreeRoot}/apps/api'; git push`, mainRoot)[0].directory).toBe(
      join(worktreeRoot, 'apps/api'),
    );
    expect(mutationsIn(`git -C "${worktreeRoot}" push`, mainRoot)[0].directory).toBe(worktreeRoot);
  });

  test('shell -c and eval inherit the cursor', () => {
    expect(mutationsIn(`cd ${worktreeRoot} && bash -c 'git push'`, mainRoot)[0].directory).toBe(worktreeRoot);
    expect(mutationsIn(`bash -c 'cd ${worktreeRoot} && git push'`, mainRoot)[0].directory).toBe(worktreeRoot);
    expect(mutationsIn(`eval "cd ${worktreeRoot}; git push"`, mainRoot)[0].directory).toBe(worktreeRoot);
  });
});

describe('bashMainCheckoutGuard', () => {
  test('a session that has only ever been in the main checkout is never guarded', () => {
    expect(fromMain('bun add left-pad')).toBeUndefined();
    expect(fromMain('git commit -m "docs"')).toBeUndefined();
    expect(guard(bash('git push origin main', join(mainRoot, 'apps/api')), state)).toBeUndefined();
  });

  test('after the session has been in a worktree, a bare mutation from main is denied and names that worktree', () => {
    visitWorktree();
    const reason = fromMain('bun add @inixiative/json-rules@2.22.0');
    expect(reason).toContain('MAIN checkout');
    expect(reason).toContain(`cd ${worktreeRoot} && bun add @inixiative/json-rules@2.22.0`);
    expect(reason).toContain(`would run in ${mainRoot}, which is the main checkout`);
  });

  test('finding 1: a hidden second line from main is denied', () => {
    visitWorktree();
    expect(fromMain('echo hi\ngit push')).toBeDefined();
    expect(fromMain('# comment\ngit push')).toBeDefined();
    expect(fromMain('git \\\n push')).toBeDefined();
  });

  test('finding 2: wrappers from main are denied', () => {
    visitWorktree();
    for (const command of [
      'FOO=1 git push',
      'rtk proxy git push',
      'sh -c "git push"',
      'eval "git push"',
      '{ git push; }',
    ]) {
      expect(fromMain(command), command).toBeDefined();
    }
  });

  test('finding 3: naming a worktree somewhere in the command does not whitelist the whole command', () => {
    visitWorktree();
    expect(fromMain(`git -C ${worktreeRoot} status && git push`)).toBeDefined();
    expect(fromMain(`cd ${worktreeRoot} && cd .. && git push`)).toBeDefined();
    expect(fromMain(`cd ${worktreeRoot}; cd ${mainRoot}; git push`)).toBeDefined();
    expect(fromMain(`cd ${mainRoot} && bun add left-pad`)).toBeDefined();
    expect(fromMain(`git -C "${mainRoot}" push`)).toBeDefined();
    expect(fromMain('cd . && git push')).toBeDefined();
    expect(fromMain('cd apps/api && bun add left-pad')).toBeDefined();
  });

  test('finding 3: a mutation whose effective directory is a worktree passes', () => {
    visitWorktree();
    expect(fromMain(`cd ${worktreeRoot} && git commit -m x`)).toBeUndefined();
    expect(fromMain(`cd "${worktreeRoot}" && git commit -m x`)).toBeUndefined();
    expect(fromMain(`cd '${worktreeRoot}/apps/api'; git push`)).toBeUndefined();
    expect(fromMain('cd .worktrees/FEAT-1234 && git push')).toBeUndefined();
    expect(fromMain(`git -C ${worktreeRoot} commit -m x`)).toBeUndefined();
    expect(fromMain('git -C .worktrees/FEAT-1234 commit -m x')).toBeUndefined();
    expect(fromMain(`git -C ${worktreeRoot} push && git status`)).toBeUndefined();
    expect(fromMain(`cd ${worktreeRoot} && git -C . push`)).toBeUndefined();
    expect(fromMain(`bun --cwd ${worktreeRoot} add left-pad`)).toBeUndefined();
    expect(fromMain(`bash -c 'cd ${worktreeRoot} && git push'`)).toBeUndefined();
  });

  test('a cd whose target does not exist or is not a checkout does not bypass the guard', () => {
    visitWorktree();
    const missing = fromMain('cd /does/not/exist; git push');
    expect(missing).toContain('cannot resolve');
    expect(fromMain('cd /bad || git commit -m x')).toBeDefined();
    expect(fromMain(`cd ${plainDir} && git push`)).toBeDefined();
    expect(fromMain('cd "$SOMEWHERE" && git push')).toBeDefined();
    const named = fromMain('git -C /does/not/exist commit -m x');
    expect(named).toContain('names /does/not/exist');
    expect(fromMain(`git -C ${plainDir} push`)).toBeDefined();
    expect(fromMain(`cd ${worktreeRoot} && git -C /does/not/exist push`)).toBeDefined();
  });

  test('finding 4: mention-only text and non-mutating forms pass from main', () => {
    visitWorktree();
    for (const command of [
      'gh pr comment 1 --body "fix; git push later"',
      'gh pr comment 1 --body "run bun install && git push"',
      'echo "then; bun add x"',
      'grep -rn "; git commit" docs/',
      'rg "git commit|git push" .',
      'gh pr create --body "$(cat <<EOF\nx; git push\nEOF\n)"',
      'cat <<EOF\ngit push\nEOF',
      'git push --dry-run',
      'git merge --abort',
      'git rebase --continue',
      'git worktree list',
      'git worktree prune --dry-run',
    ]) {
      expect(fromMain(command), JSON.stringify(command)).toBeUndefined();
    }
  });

  test('read-only and routine commands on main pass even after worktree work', () => {
    visitWorktree();
    expect(fromMain('git status')).toBeUndefined();
    expect(fromMain('git pull --ff-only origin main')).toBeUndefined();
    expect(fromMain('bun install')).toBeUndefined();
    expect(fromMain('bun run worktree:create main FEAT-9')).toBeUndefined();
    expect(fromMain('bun run worktree:destroy FEAT-1234')).toBeUndefined();
    expect(fromMain('bun run test')).toBeUndefined();
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

  test('a remembered worktree that no longer exists is not guarded', () => {
    visitWorktree();
    state.rememberWorktree(SESSION, join(mainRoot, '.worktrees/destroyed'));
    expect(fromMain('git commit -m x')).toBeUndefined();
  });

  test('finding 13: REQUIRE_MAIN_BRANCH is on, so a main checkout on another branch is not guarded', () => {
    expect(REQUIRE_MAIN_BRANCH).toBe(true);
    visitWorktree();
    withRefs('hotfix', 'main', () => {
      expect(fromMain('git commit -m x')).toBeUndefined();
    });
    expect(fromMain('git commit -m x')).toBeDefined();
  });

  test('finding 13: with the requirement off, the branch no longer matters', () => {
    visitWorktree();
    withRefs('hotfix', 'main', () => {
      expect(guard(bash('git commit -m x', mainRoot), state, { requireMainBranch: false })).toBeDefined();
    });
  });

  test('finding 13: the guarded branch is the one origin/HEAD points at, as create.sh reads it', () => {
    expect(defaultBranch(mainRoot)).toBe('main');
    visitWorktree();
    withRefs('develop', 'develop', () => {
      expect(defaultBranch(mainRoot)).toBe('develop');
      expect(fromMain('git commit -m x')).toBeDefined();
    });
    withRefs('main', 'develop', () => {
      expect(fromMain('git commit -m x')).toBeUndefined();
    });
  });

  test('a SessionStart event inside a worktree records it before any Bash call', () => {
    expect(
      guard({ hook_event_name: 'SessionStart', session_id: SESSION, cwd: join(worktreeRoot, 'apps/api') }, state),
    ).toBeUndefined();
    expect(fromMain('git push')).toBeDefined();
  });

  test('state files older than a day are pruned, fresh ones kept', () => {
    const dir = mkdtempSync(join(sandbox, 'prune-'));
    const pruned = fileSessionState(dir);
    pruned.rememberWorktree('old', worktreeRoot);
    pruned.rememberWorktree('fresh', worktreeRoot);
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    utimesSync(join(dir, 'old'), twoDaysAgo, twoDaysAgo);
    pruned.prune(24 * 60 * 60 * 1000);
    expect(pruned.lastWorktree('old')).toBeUndefined();
    expect(pruned.lastWorktree('fresh')).toBe(worktreeRoot);
  });

  test('the hook binary keeps per-session state, emits a PreToolUse deny, prunes on SessionStart, and stays silent otherwise', () => {
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
    writeFileSync(join(stateDir, 'stale'), `${worktreeRoot}\n`);
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    utimesSync(join(stateDir, 'stale'), twoDaysAgo, twoDaysAgo);
    expect(run(bash('git push', mainRoot))).toBe('');
    expect(run({ hook_event_name: 'SessionStart', session_id: SESSION, cwd: worktreeRoot })).toBe('');
    expect(fileSessionState(stateDir).lastWorktree('stale')).toBeUndefined();
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
