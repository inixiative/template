#!/usr/bin/env bun
/**
 * Detector for the no-raw-locks CI rule. Run from the repo (or fixture) root:
 *   bun scripts/ci/rules/lib/noRawLocks.ts [--write-baseline]
 *
 * Row locks are taken only by the db client's primitive, `db.findForUpdate` (packages/db/src/client.ts).
 * Fails on `FOR UPDATE` / `FOR NO KEY UPDATE` in any other non-test source, and on any shared lock
 * (`FOR SHARE`, `FOR KEY SHARE`, `LOCK IN SHARE MODE`) anywhere, the primitive included: there is no
 * shared mode (docs/claude/CONCURRENCY.md, Row locks). Only string and template-literal text is read;
 * comments never count. Upper-case keywords match anywhere in a string; lower-case ones only in a
 * string that also says `select`.
 */
import ts from 'typescript';
import { finishFence, isTestFile, lineAt, listFiles, readSource, type Violation } from './fence';

const LOCK_PRIMITIVE = 'packages/db/src/client.ts';
const SHARED = /\bFOR\s+(KEY\s+)?SHARE\b|\bLOCK\s+IN\s+SHARE\s+MODE\b/;
const EXCLUSIVE = /\bFOR\s+(NO\s+KEY\s+)?UPDATE\b/;
const STRING_KINDS = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
]);

const lockIn = (text: string, pattern: RegExp): boolean =>
  pattern.test(text) || (/\bselect\b/i.test(text) && new RegExp(pattern.source, 'i').test(text));

const stringsOf = (source: string): { text: string; offset: number }[] => {
  const out: { text: string; offset: number }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isTemplateExpression(node)) {
      const literals = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
      out.push({ text: literals.join(' '), offset: node.getStart(sourceFile) });
      for (const span of node.templateSpans) visit(span.expression);
      return;
    }
    if (STRING_KINDS.has(node.kind))
      out.push({ text: node.getText(sourceFile), offset: node.getStart(sourceFile) });
    ts.forEachChild(node, visit);
  };
  const sourceFile = ts.createSourceFile(
    'f.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  visit(sourceFile);
  return out;
};

const sqlWithoutComments = (source: string): { text: string; offset: number }[] =>
  [...source.matchAll(/^.*$/gm)].map((m) => ({
    text: m[0].replace(/--.*$/, ''),
    offset: m.index ?? 0,
  }));

const violations: Violation[] = [];

for (const file of listFiles(['apps', 'packages'], /\.(tsx?|sql)$/)) {
  if (isTestFile(file)) continue;
  const source = readSource(file);
  const pieces = file.endsWith('.sql') ? sqlWithoutComments(source) : stringsOf(source);
  for (const { text, offset } of pieces) {
    const line = lineAt(source, offset);
    if (lockIn(text, SHARED))
      violations.push({
        file,
        line,
        key: 'shared-lock',
        detail:
          'shared row lock (FOR SHARE / FOR KEY SHARE / LOCK IN SHARE MODE); there is no shared mode',
      });
    else if (file !== LOCK_PRIMITIVE && lockIn(text, EXCLUSIVE))
      violations.push({
        file,
        line,
        key: 'raw-for-update',
        detail: 'raw FOR UPDATE; use db.findForUpdate(model, where, opts?) inside db.txn()',
      });
  }
}

finishFence({
  rule: 'no-raw-locks',
  violations,
  explain: [
    'Raw row-lock SQL outside the db client. Lock rows with the primitive, inside db.txn():',
    '  db.findForUpdate(model, where)                       // SELECT * ... FOR UPDATE',
    '  db.findForUpdate(model, where, { upserting: true })  // also fences a row that does not exist yet',
    'There is no shared (FOR SHARE) mode: docs/claude/CONCURRENCY.md, Row locks.',
  ],
  clean: 'No raw row-lock SQL outside db.findForUpdate.',
});
