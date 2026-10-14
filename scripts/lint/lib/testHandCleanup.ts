#!/usr/bin/env bun
// Scans only each afterEach/afterAll body, brace-matched, so a delete that is the subject of a test
// body is never flagged. Comments are blanked; strings are not, because a TRUNCATE or DELETE FROM in
// raw SQL is exactly the hand cleanup this check exists to catch. DROP TABLE is schema teardown.
const AFTER_HOOK = /\bafter(Each|All)\s*\(/g;
const HAND_CLEANUP = /\.(delete|deleteMany)\s*\(|\bTRUNCATE\b|\bDELETE\s+FROM\b/i;

const blankComments = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (m, lead: string) => lead + ' '.repeat(m.length - lead.length));

const bodyEnd = (src: string, open: number): number => {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return i;
  }
  return src.length;
};

const lineAt = (src: string, offset: number): number => src.slice(0, offset).split('\n').length;

const violations: string[] = [];
for (const file of process.argv.slice(2)) {
  const src = blankComments(await Bun.file(file).text());
  for (const hook of src.matchAll(AFTER_HOOK)) {
    const open = src.indexOf('{', hook.index ?? 0);
    if (open === -1) continue;
    const body = src.slice(open, bodyEnd(src, open));
    const hit = HAND_CLEANUP.exec(body);
    if (hit)
      violations.push(
        `${file}:${lineAt(src, open + hit.index)}: ${body.split('\n')[lineAt(body, hit.index) - 1]?.trim()}`,
      );
  }
}

if (violations.length) {
  process.stdout.write(
    'Found hand cleanup in a test after hook.\n' +
      'The test tracker records every table a test writes and cleanupTouchedTables() truncates them,\n' +
      'so call cleanupTouchedTables(db) instead of deleting rows yourself. If a write genuinely escapes\n' +
      'the tracker (raw SQL), make that write visible to the tracker instead.\n\n' +
      `${violations.join('\n')}\n`,
  );
  process.exit(1);
}
