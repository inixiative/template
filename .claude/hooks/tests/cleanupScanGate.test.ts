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
    git('-C', repo, 'commit', '-q', '--allow-empty', '-m', 'unpushed-after-remote-test');
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

  test('docs, tickets, and low-level config commits pass without a scan', () => {
    const isolated = join(sandbox, 'exempt-repo');
    const isolatedOrigin = join(sandbox, 'exempt-origin.git');
    git('init', '-q', '-b', 'main', isolated);
    git('init', '-q', '--bare', isolatedOrigin);
    git('-C', isolated, 'remote', 'add', 'origin', isolatedOrigin);
    git('-C', isolated, 'commit', '-q', '--allow-empty', '-m', 'init');
    git('-C', isolated, 'push', '-q', 'origin', 'main');

    const commitFile = (relativePath: string, content: string) => {
      const fullPath = join(isolated, relativePath);
      mkdirSync(join(fullPath, '..'), { recursive: true });
      writeFileSync(fullPath, content);
      git('-C', isolated, 'add', relativePath);
      git('-C', isolated, 'commit', '-q', '-m', `update ${relativePath}`);
    };

    commitFile('tickets/FEAT-999-idea.md', '# Idea\n');
    expect(bash('git push origin main', isolated)).toBeUndefined();

    commitFile('apps/web/tsconfig.json', '{}\n');
    commitFile('biome.json', '{}\n');
    commitFile('.gitignore', 'tmp/\n');
    expect(bash('git push origin main', isolated)).toBeUndefined();
  });

  test('code, docs/scripts ts, hooks, and doc commits atop unscanned code stay gated', () => {
    const isolated = join(sandbox, 'gated-repo');
    const isolatedOrigin = join(sandbox, 'gated-origin.git');
    git('init', '-q', '-b', 'main', isolated);
    git('init', '-q', '--bare', isolatedOrigin);
    git('-C', isolated, 'remote', 'add', 'origin', isolatedOrigin);
    git('-C', isolated, 'commit', '-q', '--allow-empty', '-m', 'init');
    git('-C', isolated, 'push', '-q', 'origin', 'main');

    const commitFile = (relativePath: string, content: string) => {
      const fullPath = join(isolated, relativePath);
      mkdirSync(join(fullPath, '..'), { recursive: true });
      writeFileSync(fullPath, content);
      git('-C', isolated, 'add', relativePath);
      git('-C', isolated, 'commit', '-q', '-m', `update ${relativePath}`);
    };

    commitFile('docs/scripts/helper.ts', 'export const x = 1;\n');
    expect(bash('git push origin main', isolated)).toContain('has not been scanned');

    // A doc commit stacked on an unscanned code commit must remain gated.
    commitFile('tickets/FEAT-999.md', '# Ticket\n');
    expect(bash('git push origin main', isolated)).toContain('has not been scanned');

    // Once the code commit is scanned, a follow-up doc commit passes without re-scanning.
    recordScan(isolated);
    commitFile('README.md', '# Updated\n');
    expect(bash('git push origin main', isolated)).toBeUndefined();

    // Editing a hook is never exempt.
    commitFile('.claude/hooks/cleanupScanGate.ts', '// edit\n');
    expect(bash('git push origin main', isolated)).toContain('has not been scanned');

    // A stale/unknown SHA in the scan marker does not throw or fail open.
    writeFileSync(scanMarkerPath(isolated), 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef\n');
    expect(bash('git push origin main', isolated)).toContain('has not been scanned');
  });

  test('clean merge of origin/main into a doc branch passes; evil merge editing code stays gated', () => {
    const isolated = join(sandbox, 'merge-repo');
    const isolatedOrigin = join(sandbox, 'merge-origin.git');
    git('init', '-q', '-b', 'main', isolated);
    git('init', '-q', '--bare', isolatedOrigin);
    git('-C', isolated, 'remote', 'add', 'origin', isolatedOrigin);

    const commitFile = (relativePath: string, content: string) => {
      const fullPath = join(isolated, relativePath);
      mkdirSync(join(fullPath, '..'), { recursive: true });
      writeFileSync(fullPath, content);
      git('-C', isolated, 'add', relativePath);
      git('-C', isolated, 'commit', '-q', '-m', `update ${relativePath}`);
    };

    commitFile('src/app.ts', 'export const v = 1;\n');
    git('-C', isolated, 'push', '-q', 'origin', 'main');

    git('-C', isolated, 'checkout', '-q', '-b', 'docs');
    commitFile('tickets/FEAT-001.md', '# Ticket\n');

    // Upstream main advances with a code commit.
    git('-C', isolated, 'checkout', '-q', 'main');
    commitFile('src/app.ts', 'export const v = 2;\n');
    git('-C', isolated, 'push', '-q', 'origin', 'main');

    // Clean merge of origin/main into the doc-only branch stays exempt.
    git('-C', isolated, 'checkout', '-q', 'docs');
    git('-C', isolated, 'merge', '-q', '--no-edit', 'origin/main');
    expect(bash('git push origin docs', isolated)).toBeUndefined();

    // Evil merge that sneaks a code change into a merge commit is gated.
    git('-C', isolated, 'checkout', '-q', 'main');
    commitFile('src/app.ts', 'export const v = 3;\n');
    git('-C', isolated, 'push', '-q', 'origin', 'main');

    git('-C', isolated, 'checkout', '-q', 'docs');
    git('-C', isolated, 'merge', '-q', '--no-commit', '--no-ff', 'origin/main');
    writeFileSync(join(isolated, 'src/app.ts'), 'export const v = 999;\n');
    git('-C', isolated, 'add', 'src/app.ts');
    git('-C', isolated, 'commit', '-q', '-m', 'evil merge');
    expect(bash('git push origin docs', isolated)).toContain('has not been scanned');
  });
});
