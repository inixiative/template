import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gate, scanMarkerPath } from '../cleanupScanGate';

let sandbox: string;
let repo: string;
let worktree: string;
let origin: string;

const git = (...args: string[]) => {
  const result = Bun.spawnSync(['git', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null',
      GIT_AUTHOR_NAME: 'gate-test',
      GIT_AUTHOR_EMAIL: 'gate@test',
      GIT_COMMITTER_NAME: 'gate-test',
      GIT_COMMITTER_EMAIL: 'gate@test',
    },
  });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return result.stdout.toString().trim();
};

const bash = (command: string, cwd = repo) => gate({ tool_name: 'Bash', cwd, tool_input: { command } });
const recordScan = (directory: string) => writeFileSync(scanMarkerPath(directory), `${git('-C', directory, 'rev-parse', 'HEAD')}\n`);

beforeAll(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'cleanup-scan-gate-')));
  repo = join(sandbox, 'repo');
  git('init', '-q', '-b', 'main', repo);
  git('-C', repo, 'commit', '-q', '--allow-empty', '-m', 'init');
  worktree = join(sandbox, 'feature');
  git('-C', repo, 'worktree', 'add', '-q', '-b', 'feature', worktree);
  origin = join(sandbox, 'origin.git');
  git('init', '-q', '--bare', origin);
  git('-C', repo, 'remote', 'add', 'origin', origin);
});

afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

beforeEach(() => {
  for (const directory of [repo, worktree]) rmSync(scanMarkerPath(directory), { force: true });
});

describe('cleanupScanGate', () => {
  test('a push of an unscanned HEAD is denied with the skill to run', () => {
    expect(bash('git push origin main')).toContain('.claude/skills/cleanup-scan/SKILL.md');
  });

  test('a push of the scanned HEAD passes', () => {
    recordScan(repo);
    expect(bash('git push origin main')).toBeUndefined();
  });

  test('a commit after the scan needs a new scan', () => {
    recordScan(repo);
    git('-C', repo, 'commit', '-q', '--allow-empty', '-m', 'later');
    expect(bash('git push')).toContain('has not been scanned');
  });

  test('each worktree keeps its own scan', () => {
    recordScan(worktree);
    expect(bash('git push', worktree)).toBeUndefined();
    expect(bash('git push', repo)).toContain('has not been scanned');
  });

  test('the push is gated where it lands, through cd and git -C', () => {
    recordScan(repo);
    expect(bash(`cd ${worktree} && git push`)).toContain('has not been scanned');
    expect(bash(`git -C ${worktree} push`)).toContain('has not been scanned');
    expect(bash(`git -C ${repo} push`, worktree)).toBeUndefined();
  });

  test('other git commands and non-Bash tools pass', () => {
    for (const command of ['git commit -q --allow-empty -m x', 'git status', 'git fetch', 'echo "git push"'])
      expect(bash(command), command).toBeUndefined();
    expect(gate({ tool_name: 'Read', cwd: repo, tool_input: { command: 'git push' } })).toBeUndefined();
  });

  test('the commits being pushed are checked, not HEAD', () => {
    git('-C', worktree, 'commit', '-q', '--allow-empty', '-m', 'feature work');
    recordScan(repo);
    expect(bash('git push origin main')).toBeUndefined();
    expect(bash('git push origin feature')).toContain('has not been scanned');
    expect(bash('git push origin feature:main')).toContain('has not been scanned');
    expect(bash('git push --all origin')).toContain('has not been scanned');
    recordScan(worktree);
    expect(bash('git push origin feature', worktree)).toBeUndefined();
  });

  test('commits already on a remote pass, as do deletes and tag pushes', () => {
    git('-C', repo, 'commit', '-q', '--allow-empty', '-m', 'pushed');
    git('-C', repo, 'push', '-q', 'origin', 'main');
    expect(bash('git push -u origin main')).toBeUndefined();
    expect(bash('git push origin --delete stale')).toBeUndefined();
    expect(bash('git push origin :stale')).toBeUndefined();
    expect(bash('git push --tags')).toBeUndefined();
  });

  test('a commit chained before a push in one call is refused', () => {
    recordScan(repo);
    expect(bash('git commit -q -m x && git push')).toContain('push in its own call');
  });

  test('wrapped and shelled pushes are gated', () => {
    git('-C', repo, 'commit', '-q', '--allow-empty', '-m', 'unscanned');
    for (const command of ['timeout 60 git push', 'nice -n 10 git push', 'bash -c "git push"', 'rtk git push'])
      expect(bash(command), command).toContain('has not been scanned');
  });

  test('a push whose checkout cannot be told is refused', () => {
    recordScan(repo);
    for (const command of ['cd "$WT" && git push', 'GIT_DIR=/elsewhere git push', 'git --git-dir=/elsewhere push'])
      expect(bash(command), command).toContain('cannot tell which checkout');
  });

  test('a push outside a git repository fails open', () => {
    const outside = join(sandbox, 'not-a-repo');
    mkdirSync(outside, { recursive: true });
    expect(bash('git push', outside)).toBeUndefined();
  });
});
