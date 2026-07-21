#!/usr/bin/env bun
/**
 * Detector for the no-select-on-mutations CI rule. Given a list of *.ts file paths
 * (argv), flags any Prisma write that narrows its own result with `select`/`omit`.
 *
 * A narrowed write result breaks the after-write lifecycle hooks (cache invalidation,
 * webhook delivery): they consume the returned row to detect changes and derive cache
 * keys, and a partial row hides the changed column or strips the key-deriving field.
 * Reads (`findMany`/`findFirst`/…) are fine — `select` is only hazardous on writes.
 *
 * Detection is brace-aware: for each write call whose first argument is an object
 * literal, balance braces to isolate that object and flag `select`/`omit` only at its
 * top level (depth 1) — so a nested relation-write `select` and a nearby read's
 * `select` are not flagged. Prints `file:line` violations; exits 1 if any.
 */
const WRITE = /\.(create|update|upsert|delete|createManyAndReturn|updateManyAndReturn)\s*\(/g;
const KEY_AT = /^\s*['"]?(select|omit)['"]?\s*:/;

type Violation = { file: string; line: number; method: string; key: string };

const lineAt = (src: string, offset: number): number => {
  let line = 1;
  for (let i = 0; i < offset && i < src.length; i++) if (src[i] === '\n') line++;
  return line;
};

// Flag `select`/`omit` keys at depth 1 of the args object. `objText` starts at the
// object's opening `{`. A key only begins right after `{` or a depth-1 `,`, so we test
// for the key pattern only at those positions — never mid-identifier or in a value.
const depth1Hits = (objText: string): { key: string; offset: number }[] => {
  const hits: { key: string; offset: number }[] = [];
  let depth = 0;
  const checkKeyAt = (pos: number) => {
    const m = KEY_AT.exec(objText.slice(pos));
    if (m) hits.push({ key: m[1], offset: pos + (m[0].length - m[0].trimStart().length) });
  };
  for (let i = 0; i < objText.length; i++) {
    const ch = objText[i];
    if (ch === '{') {
      depth++;
      if (depth === 1) checkKeyAt(i + 1);
    } else if (ch === '}') {
      depth--;
    } else if (ch === ',' && depth === 1) {
      checkKeyAt(i + 1);
    }
  }
  return hits;
};

const scanFile = (file: string, src: string): Violation[] => {
  const violations: Violation[] = [];
  WRITE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WRITE.exec(src))) {
    const method = m[1];
    let i = m.index + m[0].length;
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] !== '{') continue; // args isn't an object literal — nothing to balance
    const start = i;
    let depth = 0;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) {
        i++;
        break;
      }
    }
    const objText = src.slice(start, i);
    for (const hit of depth1Hits(objText)) {
      violations.push({ file, line: lineAt(src, start + hit.offset), method, key: hit.key });
    }
  }
  return violations;
};

const files = process.argv.slice(2);
const all: Violation[] = [];
for (const file of files) {
  const src = await Bun.file(file)
    .text()
    .catch(() => '');
  if (src) all.push(...scanFile(file, src));
}

if (all.length > 0) {
  console.log('Found select/omit on Prisma writes (these narrow the result the lifecycle hooks consume):');
  console.log('Writes must return full rows. Drop the select/omit and shape the result after the write.');
  console.log('');
  for (const v of all) console.log(`  ${v.file}:${v.line}  ${v.method}(...) [${v.key}]`);
  process.exit(1);
}

console.log('No select/omit on Prisma writes found.');
