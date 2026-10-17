#!/usr/bin/env bun
/**
 * Detector for the doc-freshness CI rule. Run from the repo (or fixture) root:
 *   bun scripts/ci/rules/lib/docFreshness.ts [--base=<branch>] [--write-baseline]
 *
 * FAIL (in docs/claude/**, AI/ENTRYPOINT.md, FEATURES.md, apps/*\/CLAUDE.md) when a doc names
 * - a repo path that doesn't exist (backticked, or a relative markdown link);
 * - a `path:line`, `path:a-b`, `path#La-Lb` past the end of the file;
 * - a `doc.md#heading` link whose heading doesn't exist;
 * - a backticked camelCase/PascalCase identifier that appears nowhere in the repo's code
 *   (comments stripped) or in the @inixiative packages it installs.
 * Fenced code and sections headed "Under construction" / "Migrations in progress" /
 * "Not on main yet" (any level) are skipped.
 *
 * Names that live outside the repo go in scripts/ci/doc-freshness/allow.txt. Stale references
 * that predate the rule go in scripts/ci/doc-freshness/baseline.txt: they are reported, not
 * failed. A baseline entry that no longer occurs fails, so the baseline only shrinks.
 *
 * WARN (git checkouts only, never fails) when the branch changes a file whose @atlas
 * @partOf names a concept with docs (.atlas/concepts.ts) without touching any of them.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { type AtlasConfigInput, type ConceptRegistry, parseAtlasBlock } from '@inixiative/atlas';
import { slugify } from '../../../docs/regenToc';

const ROOT = process.cwd();
const WRITE_BASELINE = process.argv.includes('--write-baseline');
const DATA_DIR = 'scripts/ci/doc-freshness';
const ALLOW_FILE = `${DATA_DIR}/allow.txt`;
const BASELINE_FILE = `${DATA_DIR}/baseline.txt`;
const FIXTURE_DIR = 'scripts/ci/rule-violations/';

const isDoc = (path: string): boolean =>
  (path.startsWith('docs/claude/') && path.endsWith('.md')) ||
  path === 'AI/ENTRYPOINT.md' ||
  path === 'FEATURES.md' ||
  /^apps\/[^/]+\/CLAUDE\.md$/.test(path);

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|prisma|json|sh|ya?ml|sql|toml|css|html)$/;
const COMMENTED_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|prisma)$/;
const PATH_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|prisma|sh|ya?ml|sql|css|toml|html)$/;
const LINE_SUFFIX = /(?::(\d+)(?:-(\d+))?|#L(\d+)(?:-L?(\d+))?)$/;
const SKIPPED_HEADING =
  /^(#{1,6})\s+.*\b(under construction|migrations? in progress|not on main yet)\b/i;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const IDENT_CHAIN = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;
const CAMEL = /^[_$]*[a-z][\w$]*[A-Z][\w$]*$/;
const PASCAL = /^[A-Z][\w$]*$/;

type Kind = 'path' | 'line' | 'link' | 'anchor' | 'name';
type Problem = { doc: string; line: number; kind: Kind; value: string; detail: string };

const run = (args: string[]): string =>
  new TextDecoder().decode(Bun.spawnSync(['git', ...args], { cwd: ROOT }).stdout).trim();

const isGit = existsSync(join(ROOT, '.git'));

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(join(ROOT, dir))) {
    if (entry === 'node_modules' || entry === '.git' || entry === '.worktrees') continue;
    const rel = dir ? `${dir}/${entry}` : entry;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
};

const files: string[] = (
  isGit ? run(['ls-files', '--cached', '--others', '--exclude-standard']).split('\n') : walk('')
).filter((f) => f && existsSync(join(ROOT, f)));
const fileSet = new Set(files);
const dirSet = new Set<string>();
for (const file of files) {
  const parts = file.split('/');
  for (let i = 1; i < parts.length; i++) dirSet.add(parts.slice(0, i).join('/'));
}
const rootEntries = new Set(files.map((f) => f.split('/')[0]));
const byBase = new Map<string, string[]>();
for (const path of [...fileSet, ...dirSet]) {
  const base = path.slice(path.lastIndexOf('/') + 1);
  byBase.set(base, [...(byBase.get(base) ?? []), path]);
}

type Workspace = { dir: string; exports: Record<string, unknown> };
const workspaces = new Map<string, Workspace>();
for (const file of files) {
  if (!file.endsWith('package.json') || file.includes('node_modules/')) continue;
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
    const exports = typeof pkg.exports === 'object' && pkg.exports !== null ? pkg.exports : {};
    if (typeof pkg.name === 'string') workspaces.set(pkg.name, { dir: dirname(file), exports });
  } catch {}
}
const workspaceScopes = new Set(
  [...workspaces.keys()].filter((n) => n.startsWith('@')).map((n) => n.split('/')[0]),
);

const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\w\\])\/\/[^\n]*/g, '$1');

const knownNames = (): Set<string> => {
  const names = new Set<string>();
  const add = (src: string) => {
    for (const m of src.matchAll(/[A-Za-z_$][\w$]*/g)) names.add(m[0]);
  };
  const generated = isGit
    ? run(['ls-files', '--others', '--ignored', '--exclude-standard'])
        .split('\n')
        .filter(
          (f) => !f.includes('node_modules/') && (f.includes('/generated/') || f.includes('.gen.')),
        )
    : [];
  for (const file of [...files, ...generated]) {
    if (
      isDoc(file) ||
      !CODE_EXT.test(file) ||
      file.startsWith(FIXTURE_DIR) ||
      // Generated Warden knowledge (`.foundry/regions/**`) repeats the docs' names; it is not code.
      file.startsWith('.foundry/') ||
      !existsSync(join(ROOT, file))
    )
      continue;
    const src = readFileSync(join(ROOT, file), 'utf8');
    add(COMMENTED_EXT.test(file) ? stripComments(src) : src);
  }
  const installed = new Bun.Glob('node_modules/@inixiative/*/**/*.{ts,mts,cts,js,mjs,cjs}');
  for (const file of installed.scanSync({ cwd: ROOT, followSymlinks: true })) {
    if (file.slice('node_modules/'.length).includes('node_modules/')) continue;
    add(stripComments(readFileSync(join(ROOT, file), 'utf8')));
  }
  return names;
};

type Span = { line: number; text: string };
type DocParts = { code: Span[]; links: Span[]; anchors: Set<string> };

const parseDoc = (doc: string): DocParts => {
  const code: Span[] = [];
  const links: Span[] = [];
  const anchors = new Set<string>();
  const seen = new Map<string, number>();
  let fence = '';
  let skipDepth = 0;
  readFileSync(join(ROOT, doc), 'utf8')
    .split('\n')
    .forEach((line, index) => {
      const fenceMark = line.trimStart().match(/^(```|~~~)/);
      if (fenceMark) {
        if (!fence) fence = fenceMark[1];
        else if (fenceMark[1] === fence) fence = '';
        return;
      }
      if (fence) return;
      const heading = line.match(HEADING);
      if (heading) {
        const base = slugify(heading[2]);
        const count = seen.get(base) ?? 0;
        anchors.add(count === 0 ? base : `${base}-${count}`);
        seen.set(base, count + 1);
        if (skipDepth && heading[1].length <= skipDepth) skipDepth = 0;
        const skip = line.match(SKIPPED_HEADING);
        if (skip) skipDepth = skip[1].length;
      }
      if (skipDepth) return;
      for (const m of line.matchAll(/`([^`]+)`/g))
        code.push({ line: index + 1, text: m[1].trim() });
      const prose = line.replace(/`[^`]*`/g, '');
      for (const m of prose.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g))
        links.push({ line: index + 1, text: m[1] });
    });
  return { code, links, anchors };
};

const parsed = new Map<string, DocParts>();
const partsOf = (doc: string): DocParts => {
  const hit = parsed.get(doc);
  if (hit) return hit;
  const parts = parseDoc(doc);
  parsed.set(doc, parts);
  return parts;
};

const variants = (path: string): string[] => {
  const p = path.replace(/\/+$/, '');
  return PATH_EXT.test(p) ? [p] : [p, `${p}.ts`, `${p}.tsx`, `${p}/index.ts`, `${p}/index.tsx`];
};

const existsExact = (path: string): string[] =>
  variants(normalize(path)).filter(
    (v) => fileSet.has(v) || dirSet.has(v) || existsSync(join(ROOT, v)),
  );

const existsSuffix = (path: string): string[] =>
  variants(path).flatMap((v) => {
    const base = v.slice(v.lastIndexOf('/') + 1);
    return (byBase.get(base) ?? []).filter((c) => c === v || c.endsWith(`/${v}`));
  });

type PathRef = { path: string; from?: number; to?: number; anchor?: string };

// A slash alone doesn't make a path: `owner/grant` is a route name.
const asPath = (raw: string): PathRef | undefined => {
  if (/[\s<>*{}…|,;'"()[\]]/.test(raw) || raw.includes('...') || raw.includes('://'))
    return undefined;
  if (/^([/~-]|\.git\/|##)/.test(raw)) return undefined;
  const hashAt = raw.search(/#(?!L\d)[^/]*$/);
  const anchor = hashAt > 0 ? raw.slice(hashAt + 1) : undefined;
  const ref = hashAt > 0 ? raw.slice(0, hashAt) : raw;
  const m = ref.match(LINE_SUFFIX);
  const path = m ? ref.slice(0, m.index) : ref;
  if (/^(#\/|@[\w-]+\/?|\.\w+)$/.test(path)) return undefined;
  const from = m ? Number(m[1] ?? m[3]) : undefined;
  const to = m ? Number(m[2] ?? m[4] ?? m[1] ?? m[3]) : undefined;
  const ext = PATH_EXT.test(path.replace(/\/+$/, ''));
  if (!path.includes('/')) return ext ? { path, from, to, anchor } : undefined;
  const rooted =
    rootEntries.has(path.split('/')[0]) ||
    /^(#\/|\.\.?\/)/.test(path) ||
    (path.startsWith('@') && workspaceScopes.has(path.split('/')[0]));
  return ext || rooted || path.endsWith('/') ? { path, from, to, anchor } : undefined;
};

const resolvePath = (path: string, doc: string): string[] | 'skip' => {
  if (path.startsWith('@')) {
    const [scope, name, ...rest] = path.split('/');
    const pkg = workspaces.get(`${scope}/${name}`);
    if (!pkg) return workspaceScopes.has(scope) ? [] : 'skip';
    const sub = rest.join('/').replace(/\/+$/, '');
    if (!sub || `./${sub}` in pkg.exports) return [pkg.dir];
    const mapped = Object.entries(pkg.exports).flatMap(([key, target]) => {
      const prefix = key.slice(0, -1);
      if (!key.endsWith('/*') || typeof target !== 'string' || !`./${sub}`.startsWith(prefix))
        return [];
      return existsExact(join(pkg.dir, target.replace('*', `./${sub}`.slice(prefix.length))));
    });
    return [
      ...mapped,
      ...existsExact(`${pkg.dir}/${sub}`),
      ...existsExact(`${pkg.dir}/src/${sub}`),
    ];
  }
  if (path.startsWith('#/')) return existsSuffix(path.slice(2));
  if (/^\.\.?\//.test(path)) return existsExact(join(dirname(doc), path));
  if (rootEntries.has(path.split('/')[0])) return existsExact(path);
  const local = [...existsExact(join(dirname(doc), path)), ...existsExact(path)];
  return local.length > 0 ? local : existsSuffix(path);
};

const lineCount = (path: string): number => {
  const text = readFileSync(join(ROOT, path), 'utf8');
  const n = text.split('\n').length;
  return text.endsWith('\n') ? n - 1 : n;
};

const isFile = (path: string): boolean =>
  existsSync(join(ROOT, path)) && statSync(join(ROOT, path)).isFile();

const lineProblem = (
  doc: string,
  at: number,
  ref: PathRef,
  hits: string[],
  shown: string,
): Problem | undefined => {
  if (ref.to === undefined) return undefined;
  const lengths = hits.filter(isFile).map(lineCount);
  if (lengths.length === 0 || lengths.some((n) => (ref.to ?? 0) <= n && (ref.from ?? 1) >= 1))
    return undefined;
  return {
    doc,
    line: at,
    kind: 'line',
    value: shown,
    detail: `line out of range: ${shown} (file has ${Math.max(...lengths)} lines)`,
  };
};

const namesIn = (raw: string): string[] => {
  const token = raw
    .replace(/\(.*\)$/, '')
    .replace(/<.*>$/, '')
    .replace(/\[\]$/, '')
    .replace(/[?!:]$/, '');
  if (!IDENT_CHAIN.test(token)) return [];
  return token.split('.').filter((s) => CAMEL.test(s) || (PASCAL.test(s) && /[a-z]/.test(s)));
};

const checkDoc = (doc: string, names: Set<string>): Problem[] => {
  const problems: Problem[] = [];
  const { code, links } = partsOf(doc);
  for (const span of code) {
    const ref = asPath(span.text);
    if (ref) {
      const hits = resolvePath(ref.path, doc);
      if (hits === 'skip') continue;
      if (hits.length === 0) {
        problems.push({
          doc,
          line: span.line,
          kind: 'path',
          value: ref.path,
          detail: `path not found: ${ref.path}`,
        });
        continue;
      }
      const line = lineProblem(doc, span.line, ref, hits, span.text);
      if (line) problems.push(line);
      const md = hits.find((h) => h.endsWith('.md') && isFile(h));
      if (ref.anchor && md && !partsOf(md).anchors.has(ref.anchor.toLowerCase())) {
        problems.push({
          doc,
          line: span.line,
          kind: 'anchor',
          value: span.text,
          detail: `broken anchor: ${span.text}`,
        });
      }
      continue;
    }
    for (const name of namesIn(span.text)) {
      if (!names.has(name)) {
        problems.push({
          doc,
          line: span.line,
          kind: 'name',
          value: name,
          detail: `name not in code: ${name}`,
        });
      }
    }
  }
  for (const span of links) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(span.text)) continue;
    const hashAt = span.text.indexOf('#');
    const target = hashAt === -1 ? span.text : span.text.slice(0, hashAt);
    const anchor = hashAt === -1 ? '' : decodeURIComponent(span.text.slice(hashAt + 1));
    const path =
      target === ''
        ? doc
        : target.startsWith('/')
          ? target.slice(1)
          : normalize(join(dirname(doc), target));
    const hits = existsExact(path);
    if (hits.length === 0) {
      problems.push({
        doc,
        line: span.line,
        kind: 'link',
        value: span.text,
        detail: `broken link: ${span.text}`,
      });
      continue;
    }
    if (!anchor) continue;
    const lineRef = anchor.match(/^L(\d+)(?:-L?(\d+))?$/);
    if (lineRef) {
      const ref = { path, from: Number(lineRef[1]), to: Number(lineRef[2] ?? lineRef[1]) };
      const line = lineProblem(doc, span.line, ref, hits, span.text);
      if (line) problems.push(line);
    } else if (
      path.endsWith('.md') &&
      isFile(path) &&
      !partsOf(path).anchors.has(anchor.toLowerCase())
    ) {
      problems.push({
        doc,
        line: span.line,
        kind: 'anchor',
        value: span.text,
        detail: `broken anchor: ${span.text}`,
      });
    }
  }
  return problems;
};

const conceptWarnings = async (): Promise<string[]> => {
  if (!isGit || !existsSync(join(ROOT, '.atlas/concepts.ts'))) return [];
  const base = process.argv.find((a) => a.startsWith('--base='))?.slice('--base='.length) || 'main';
  let from = run(['merge-base', `origin/${base}`, 'HEAD']) || run(['merge-base', base, 'HEAD']);
  if (!from) return [];
  if (from === run(['rev-parse', 'HEAD']))
    from = run(['rev-parse', '--verify', '--quiet', 'HEAD~1']);
  if (!from) return [];
  const changed = run(['diff', '--name-only', '--diff-filter=AMR', `${from}...HEAD`])
    .split('\n')
    .filter(Boolean);
  if (changed.length === 0) return [];
  const changedSet = new Set(changed);
  const { CONCEPTS } = (await import(join(ROOT, '.atlas/concepts.ts'))) as {
    CONCEPTS: ConceptRegistry;
  };
  const configModule: { default?: AtlasConfigInput; config?: AtlasConfigInput } = existsSync(
    join(ROOT, '.atlas/config.ts'),
  )
    ? await import(join(ROOT, '.atlas/config.ts'))
    : {};
  const config = configModule.default ?? configModule.config ?? {};
  const toPath = config.references?.docs ?? ((v: string) => `docs/claude/${v}`);
  const byConcept = new Map<string, string[]>();
  for (const file of changed) {
    if (isDoc(file) || !/\.(ts|tsx)$/.test(file) || !existsSync(join(ROOT, file))) continue;
    const block = parseAtlasBlock(readFileSync(join(ROOT, file), 'utf8'));
    for (const concept of block?.partOf ?? [])
      byConcept.set(concept, [...(byConcept.get(concept) ?? []), file]);
  }
  const warnings: string[] = [];
  for (const [concept, codeFiles] of [...byConcept].sort(([a], [b]) => a.localeCompare(b))) {
    const docs = (CONCEPTS[concept]?.docs ?? []).map(toPath);
    if (docs.length === 0 || docs.some((d) => changedSet.has(d))) continue;
    const shown =
      codeFiles.slice(0, 3).join(', ') +
      (codeFiles.length > 3 ? ` (+${codeFiles.length - 3} more)` : '');
    warnings.push(`${concept}: ${shown} changed; none of its docs (${docs.join(', ')}) did`);
  }
  return warnings;
};

const readList = (path: string): string[] =>
  existsSync(join(ROOT, path))
    ? readFileSync(join(ROOT, path), 'utf8')
        .split('\n')
        .map((l) => l.trimEnd())
        .filter((l) => l.trim() && !l.trimStart().startsWith('#'))
    : [];

const keyOf = (p: Problem): string => `${p.doc}\t${p.kind}\t${p.value}`;

// Generated and local artifacts (MAP.md, *.gen.ts, .worktrees/) may be absent from a checkout.
const dropIgnored = (problems: Problem[]): Problem[] => {
  if (!isGit) return problems;
  const candidates = (p: Problem): string[] => {
    const path = p.value.split('#')[0].replace(/\/+$/, '');
    return [path, normalize(join(dirname(p.doc), path))];
  };
  const asked = problems.filter((p) => p.kind === 'path' || p.kind === 'link').flatMap(candidates);
  if (asked.length === 0) return problems;
  const out = Bun.spawnSync(['git', 'check-ignore', '--no-index', '--stdin'], {
    cwd: ROOT,
    stdin: new TextEncoder().encode(asked.join('\n')),
  });
  const ignored = new Set(new TextDecoder().decode(out.stdout).split('\n').filter(Boolean));
  return problems.filter(
    (p) => !(p.kind === 'path' || p.kind === 'link') || !candidates(p).some((c) => ignored.has(c)),
  );
};

const main = async () => {
  const names = knownNames();
  const allow = new Set(readList(ALLOW_FILE).map((l) => l.trim()));
  const allowed = (p: Problem) => allow.has(p.value) || allow.has(`${p.doc}\t${p.value}`);
  const docs = files.filter(isDoc).sort();
  const problems = dropIgnored(
    docs.flatMap((doc) => checkDoc(doc, names)).filter((p) => !allowed(p)),
  );
  const keys = [...new Set(problems.map(keyOf))].sort();

  if (WRITE_BASELINE) {
    const header = [
      '# Stale doc references that predate the doc-freshness rule: reported, not failed.',
      '# One per line: <doc>\\t<kind>\\t<value>. Fix the doc and delete its line; never add lines by hand.',
      '# Regenerate: bun scripts/ci/rules/lib/docFreshness.ts --write-baseline',
    ];
    writeFileSync(join(ROOT, BASELINE_FILE), `${[...header, ...keys].join('\n')}\n`);
    console.log(`Wrote ${keys.length} baseline entries to ${BASELINE_FILE}.`);
    return 0;
  }

  for (const warning of await conceptWarnings()) console.log(`WARN doc-freshness: ${warning}`);

  const baseline = new Set(readList(BASELINE_FILE));
  const fresh = problems.filter((p) => !baseline.has(keyOf(p)));
  const current = new Set(keys);
  const fixed = [...baseline].filter((k) => !current.has(k));

  const baselined = keys.filter((k) => baseline.has(k));
  if (baselined.length > 0) {
    const perDoc = new Map<string, number>();
    for (const k of baselined)
      perDoc.set(k.split('\t')[0], (perDoc.get(k.split('\t')[0]) ?? 0) + 1);
    const top = [...perDoc]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([d, n]) => `${d} ${n}`)
      .join(', ');
    console.log(
      `${baselined.length} known stale doc reference(s) in ${BASELINE_FILE} (not blocking). Most: ${top}.`,
    );
  }

  let failed = false;
  if (fresh.length > 0) {
    failed = true;
    console.log(
      'Docs name things that do not exist. Fix the doc (or, for an external name, add it to',
    );
    console.log(`${ALLOW_FILE}):`);
    for (const p of fresh) console.log(`  ${p.doc}:${p.line} ${p.detail}`);
  }
  if (fixed.length > 0) {
    failed = true;
    console.log(`These ${BASELINE_FILE} entries no longer occur; delete their lines:`);
    for (const k of fixed) console.log(`  ${k.replaceAll('\t', ' ')}`);
  }
  if (!failed) console.log(`Doc references resolve (${docs.length} docs checked).`);
  return failed ? 1 : 0;
};

process.exit(await main());
