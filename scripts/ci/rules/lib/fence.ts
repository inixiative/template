/**
 * Shared runner for the fence rules (uuidv7-ids, one-middleware-chain, no-raw-locks, no-db-params,
 * bearer-only-auth).
 * A detector hands over its violations; this file applies the rule's exemptions and baseline and exits.
 *
 * Data lives in scripts/ci/<rule>/ under the repo (or fixture) root:
 * - exempt.txt: `<key>\t<reason>`. A deliberate exception; the reason is required, and an entry that
 *   no longer matches a violation fails so the list stays true.
 * - baseline.txt: `<file>\t<key>`, one per existing violation, written by `--write-baseline`. Listed
 *   violations are reported, not failed, so the rule fences new code while the old is burned down.
 *   An entry that no longer occurs fails until its line is deleted, and in a git checkout a line the
 *   merge base's baseline does not have fails, so the baseline only shrinks.
 * A key names the violation by content (model, mount path, function and parameter, SQL text), never
 * by line, so unrelated edits do not churn it and a new violation does not inherit a fixed one's key.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export type Violation = { file: string; line: number; key: string; detail: string };

export const ROOT = process.cwd();

const SKIPPED_DIRS = new Set(['node_modules', '.git', '.worktrees', 'generated', 'dist', '.turbo']);
const IS_GIT = existsSync(join(ROOT, '.git'));

const git = (args: string[]): { ok: boolean; out: string } => {
  const result = Bun.spawnSync(['git', ...args], { cwd: ROOT, stderr: 'ignore' });
  return { ok: result.exitCode === 0, out: new TextDecoder().decode(result.stdout) };
};

export const listFiles = (dirs: string[], extension: RegExp): string[] => {
  if (IS_GIT)
    return git(['ls-files', '--cached', '--others', '--exclude-standard', '--', ...dirs])
      .out.split('\n')
      .filter((f) => f && extension.test(f) && !f.split('/').some((p) => SKIPPED_DIRS.has(p)))
      .filter((f) => existsSync(join(ROOT, f)))
      .sort();
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(ROOT, dir))) {
      if (SKIPPED_DIRS.has(entry)) continue;
      const path = dir ? `${dir}/${entry}` : entry;
      if (statSync(join(ROOT, path)).isDirectory()) walk(path);
      else if (extension.test(entry)) out.push(path);
    }
  };
  for (const dir of dirs) if (existsSync(join(ROOT, dir))) walk(dir);
  return out.sort();
};

export const isTestFile = (file: string): boolean =>
  /\.test\.tsx?$/.test(file) || /(^|\/)(tests?|__tests__)\//.test(file);

export const readSource = (file: string): string => readFileSync(join(ROOT, file), 'utf8');

export const lineAt = (source: string, offset: number): number => {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) if (source[i] === '\n') line++;
  return line;
};

const parseEntries = (text: string): string[][] =>
  text
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() && !l.trimStart().startsWith('#'))
    .map((l) => l.split('\t'));

const readEntries = (path: string): string[][] =>
  existsSync(join(ROOT, path)) ? parseEntries(readFileSync(join(ROOT, path), 'utf8')) : [];

const mergeBaseEntries = (path: string): string[][] | null => {
  if (!IS_GIT) return null;
  const base = git(['merge-base', `origin/${process.env.GITHUB_BASE_REF || 'main'}`, 'HEAD']);
  if (!base.ok) return null;
  const shown = git(['show', `${base.out.trim()}:${path}`]);
  return shown.ok ? parseEntries(shown.out) : null;
};

export const readExemptions = (rule: string): Map<string, string> =>
  new Map(readEntries(`scripts/ci/${rule}/exempt.txt`).map(([key, reason]) => [key, reason ?? '']));

const baselineKeys = (violations: Violation[]): string[] => {
  const seen = new Map<string, number>();
  return violations.map((v) => {
    const base = `${v.file}\t${v.key}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  });
};

type FenceInput = {
  rule: string;
  violations: Violation[];
  usedExemptions?: Set<string>;
  explain: string[];
  clean: string;
};

export const finishFence = ({ rule, violations, usedExemptions, explain, clean }: FenceInput) => {
  const dataDir = `scripts/ci/${rule}`;
  const baselineFile = `${dataDir}/baseline.txt`;
  const sorted = [...violations].sort((a, b) =>
    a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1,
  );
  const keys = baselineKeys(sorted);

  if (process.argv.includes('--write-baseline')) {
    const detector = `scripts/ci/rules/lib/${basename(process.argv[1] ?? '')}`;
    const header = [
      `# Violations of the ${rule} rule that predate it: reported, not failed.`,
      '# One per line: <file>\\t<key>. Fix the code and delete its line; never add lines by hand.',
      `# Written by \`bun ${detector} --write-baseline\` when the rule landed; rewriting it to absorb new violations defeats the fence.`,
    ];
    mkdirSync(join(ROOT, dataDir), { recursive: true });
    writeFileSync(
      join(ROOT, baselineFile),
      `${[...header, ...[...new Set(keys)].sort()].join('\n')}\n`,
    );
    console.log(`Wrote ${keys.length} baseline entries to ${baselineFile}.`);
    process.exit(0);
  }

  let failed = false;

  const exemptions = readExemptions(rule);
  const unreasoned = [...exemptions].filter(([, reason]) => !reason.trim());
  if (unreasoned.length > 0) {
    failed = true;
    console.log(`${dataDir}/exempt.txt entries need a one-line reason after a tab:`);
    for (const [key] of unreasoned) console.log(`  ${key}`);
  }
  if (!usedExemptions && exemptions.size > 0) {
    failed = true;
    console.log(`${rule} takes no exemptions; delete ${dataDir}/exempt.txt and fix the code.`);
  }
  if (usedExemptions) {
    const unused = [...exemptions.keys()].filter((key) => !usedExemptions.has(key));
    if (unused.length > 0) {
      failed = true;
      console.log(`${dataDir}/exempt.txt entries no longer match anything; delete them:`);
      for (const key of unused) console.log(`  ${key}`);
    }
  }

  const baseline = new Set(readEntries(baselineFile).map((parts) => parts.join('\t')));
  const baseEntries = mergeBaseEntries(baselineFile);
  if (baseEntries) {
    const before = new Set(baseEntries.map((parts) => parts.join('\t')));
    const added = [...baseline].filter((k) => !before.has(k));
    if (added.length > 0) {
      failed = true;
      console.log(`${baselineFile} gained entries since the merge base; fix the code instead:`);
      for (const k of added) console.log(`  ${k.replaceAll('\t', ' ')}`);
    }
  }
  const current = new Set(keys);
  const fresh = sorted.filter((_, i) => !baseline.has(keys[i]));
  const fixed = [...baseline].filter((k) => !current.has(k));
  const known = keys.length - fresh.length;
  if (known > 0) console.log(`${known} known violation(s) in ${baselineFile} (not blocking).`);

  if (fresh.length > 0) {
    failed = true;
    for (const line of explain) console.log(line);
    console.log('');
    for (const v of fresh) console.log(`  ${v.file}:${v.line} ${v.detail}`);
  }
  if (fixed.length > 0) {
    failed = true;
    console.log(`These ${baselineFile} entries no longer occur; delete their lines:`);
    for (const k of fixed) console.log(`  ${k.replaceAll('\t', ' ')}`);
  }
  if (!failed) console.log(known > 0 ? 'No new violations.' : clean);
  process.exit(failed ? 1 : 0);
};
