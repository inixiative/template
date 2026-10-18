#!/usr/bin/env bun
/**
 * Detector for the uuidv7-ids CI rule. Run from the repo (or fixture) root:
 *   bun scripts/ci/rules/lib/uuidv7Ids.ts [--write-baseline]
 *
 * Every Prisma model's primary key is exactly
 *   id String @id @default(dbgenerated("uuidv7()")) @db.VarChar(36)
 * (attribute order free). Fails on a model with no such field: a v4 `uuid()`/`cuid()` default, a
 * different type or length, an id under another name, or a composite `@@id`. Why: v7 ids are
 * time-ordered, and `paginate()`'s `{ id: desc }` tiebreaker and every cursor depend on that.
 */
import { finishFence, lineAt, listFiles, readSource, type Violation } from './fence';

const REQUIRED = ['@id', '@default(dbgenerated("uuidv7()"))', '@db.VarChar(36)'];
const MODEL = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;

const attributesOf = (rest: string): string[] => {
  const attributes: string[] = [];
  let i = 0;
  while (i < rest.length) {
    if (rest[i] !== '@') {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < rest.length && /[\w.@]/.test(rest[j])) j++;
    if (rest[j] === '(') {
      let depth = 0;
      for (; j < rest.length; j++) {
        if (rest[j] === '(') depth++;
        else if (rest[j] === ')' && --depth === 0) {
          j++;
          break;
        }
      }
    }
    attributes.push(rest.slice(i, j).replace(/\s+/g, ''));
    i = j;
  }
  return attributes;
};

const violations: Violation[] = [];

for (const file of listFiles(['apps', 'packages'], /\.prisma$/)) {
  const source = readSource(file);
  MODEL.lastIndex = 0;
  for (let m = MODEL.exec(source); m !== null; m = MODEL.exec(source)) {
    const [, model, body] = m;
    const bodyOffset = m.index + m[0].indexOf('{') + 1;
    const report = (offset: number, detail: string) =>
      violations.push({
        file,
        line: lineAt(source, offset),
        key: model,
        detail: `${model}: ${detail}`,
      });

    if (/^\s*@@id\b/m.test(body)) {
      report(
        bodyOffset + body.search(/@@id\b/),
        'composite @@id; give it a uuidv7 id and a @@unique',
      );
      continue;
    }
    const fields = [...body.matchAll(/^[ \t]*(\w+)[ \t]+(\S+)([^\n]*)$/gm)].filter(
      (f) => !f[1].startsWith('@@'),
    );
    const idField = fields.find((f) => attributesOf(f[3].replace(/\/\/.*$/, '')).includes('@id'));
    if (!idField) {
      report(m.index, 'no @id field');
      continue;
    }
    const attributes = attributesOf(idField[3].replace(/\/\/.*$/, ''));
    const missing = REQUIRED.filter((a) => !attributes.includes(a));
    const offset = bodyOffset + (idField.index ?? 0);
    if (idField[1] !== 'id' || idField[2] !== 'String' || missing.length > 0)
      report(
        offset,
        `id must be \`id String ${REQUIRED.join(' ')}\` (found \`${idField[0].trim().replace(/\s+/g, ' ')}\`)`,
      );
  }
}

finishFence({
  rule: 'uuidv7-ids',
  violations,
  explain: [
    'Prisma models without a uuidv7 primary key. Every model id is:',
    '  id String @id @default(dbgenerated("uuidv7()")) @db.VarChar(36)',
  ],
  clean: 'Every Prisma model id is a uuidv7 VarChar(36).',
});
