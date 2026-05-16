#!/usr/bin/env bun
/**
 * Regenerate the table of contents at the top of every markdown doc.
 *
 * Scans `## `, `### `, `#### ` headings (skipping code blocks and the TOC
 * section itself) and emits a nested bullet list of anchor links wrapped in
 * `<!-- toc:start -->` / `<!-- toc:end -->` markers.
 *
 * - If the markers exist in a doc, the content between them is replaced.
 * - If a doc has a legacy `## Contents` section without markers, that
 *   section is removed and replaced with the marker-wrapped form.
 * - Otherwise the marker block is inserted after the first `# ` heading.
 *
 * Usage:
 *   bun run scripts/docs/regenToc.ts [paths...]
 *
 * Defaults to operating on `docs/claude/`, `FEATURES.md`, `COMPARISONS.md`,
 * `TODO.md`, and `README.md`.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const TOC_START = '<!-- toc:start -->';
const TOC_END = '<!-- toc:end -->';

const DEFAULTS = ['docs/claude', 'FEATURES.md', 'COMPARISONS.md', 'TODO.md', 'README.md'];

// GitHub-flavored anchor. The non-obvious rule: every single whitespace char
// becomes one hyphen (NOT collapsed), so `## A & B` (two spaces after stripping
// `&`) anchors to `a--b`. Drop backticks and any char that isn't a word char,
// whitespace, or hyphen — matches GitHub's behavior for the heading shapes in
// our doc set. Doesn't perfectly handle emojis or duplicate-heading dedup.
const slugify = (heading: string): string =>
  heading
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s/g, '-');

type Heading = { level: number; text: string; slug: string };

const extractHeadings = (md: string): Heading[] => {
  const lines = md.split('\n');
  const out: Heading[] = [];
  let inCodeBlock = false;
  let inExistingToc = false;
  for (const line of lines) {
    if (line.includes(TOC_START)) {
      inExistingToc = true;
      continue;
    }
    if (line.includes(TOC_END)) {
      inExistingToc = false;
      continue;
    }
    if (inExistingToc) continue;
    if (line.startsWith('```')) inCodeBlock = !inCodeBlock;
    if (inCodeBlock) continue;
    const m = line.match(/^(#{2,4})\s+(.+?)\s*$/);
    if (!m) continue;
    const text = m[2]!;
    out.push({ level: m[1]!.length, text, slug: slugify(text) });
  }
  return out;
};

const renderToc = (headings: Heading[]): string => {
  if (headings.length === 0) return '';
  const minLevel = Math.min(...headings.map((h) => h.level));
  return headings.map(({ level, text, slug }) => `${'  '.repeat(level - minLevel)}- [${text}](#${slug})`).join('\n');
};

// Remove a legacy `## Contents` section that doesn't use the markers. The
// section runs from the heading up to (but not including) the next `## `
// heading, with trailing blank lines and `---` separators trimmed.
const stripLegacyContents = (md: string): string => {
  const lines = md.split('\n');
  let inExistingToc = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.includes(TOC_START)) {
      inExistingToc = true;
      continue;
    }
    if (lines[i]!.includes(TOC_END)) {
      inExistingToc = false;
      continue;
    }
    if (inExistingToc) continue;
    if (lines[i]!.trim() === '## Contents') {
      let end = i + 1;
      while (end < lines.length && !lines[end]!.match(/^## /)) end++;
      while (end > i + 1 && (lines[end - 1]!.trim() === '' || lines[end - 1]!.trim() === '---')) {
        end--;
      }
      lines.splice(i, end - i);
      return lines.join('\n');
    }
  }
  return md;
};

const buildBlock = (toc: string): string => `${TOC_START}\n\n## Contents\n\n${toc}\n\n${TOC_END}`;

const updateToc = (md: string): { content: string; changed: boolean } => {
  const cleaned = stripLegacyContents(md);
  const headings = extractHeadings(cleaned);
  if (headings.length === 0) return { content: cleaned, changed: cleaned !== md };
  const block = buildBlock(renderToc(headings));
  const re = new RegExp(`${TOC_START}[\\s\\S]*?${TOC_END}`);
  if (re.test(cleaned)) {
    const replaced = cleaned.replace(re, block);
    return { content: replaced, changed: replaced !== md };
  }
  const lines = cleaned.split('\n');
  const h1Index = lines.findIndex((l) => l.startsWith('# '));
  if (h1Index === -1) return { content: `${block}\n\n${cleaned}`, changed: true };
  lines.splice(h1Index + 1, 0, '', block);
  const out = lines.join('\n');
  return { content: out, changed: out !== md };
};

const walk = (path: string): string[] => {
  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(path);
  } catch {
    return [];
  }
  if (stat.isFile() && extname(path) === '.md') return [path];
  if (!stat.isDirectory()) return [];
  return readdirSync(path).flatMap((entry) => walk(join(path, entry)));
};

const main = () => {
  const args = process.argv.slice(2);
  const paths = args.length > 0 ? args : DEFAULTS;
  const files = paths.flatMap(walk);
  let touched = 0;
  for (const file of files) {
    const original = readFileSync(file, 'utf8');
    const { content, changed } = updateToc(original);
    if (changed) {
      writeFileSync(file, content);
      console.log(`updated: ${file}`);
      touched += 1;
    }
  }
  console.log(`\n${touched} file(s) updated, ${files.length - touched} unchanged`);
};

main();
