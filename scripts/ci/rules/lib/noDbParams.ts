#!/usr/bin/env bun
/**
 * Detector for the no-db-params CI rule. Run from the repo (or fixture) root:
 *   bun scripts/ci/rules/lib/noDbParams.ts [--write-baseline]
 *
 * Services, handlers and helpers use the scoped client (`import { db } from '@template/db'`): it
 * resolves to the open transaction through AsyncLocalStorage, so passing a client by hand is never
 * needed and a passed one can be the wrong one. Fails on a function or method parameter (signatures
 * in types and interfaces included) named `db`/`txn`/`tx`/`prisma`, or typed `Db`, `PrismaClient`,
 * `TransactionClient` or `typeof db`. A context object that carries `db` (a job's WorkerContext) is
 * not a parameter and is not flagged.
 *
 * Out of scope: tests and packages/db, whose internals define `db`. The one other client-taking
 * code is json-rules' Prisma planner, which lives outside the app (Aron, 2026-10-18). An exception
 * goes in scripts/ci/no-db-params/exempt.txt as `<file>\t<reason>`.
 */
import ts from 'typescript';
import {
  finishFence,
  isTestFile,
  lineAt,
  listFiles,
  readExemptions,
  readSource,
  type Violation,
} from './fence';

const OUT_OF_SCOPE = /^packages\/db\//;
const DB_NAMES = new Set(['db', 'txn', 'tx', 'prisma']);
const DB_TYPE = /(^|[^\w.])(Db|PrismaClient|(Prisma\.)?TransactionClient)\b|\btypeof\s+db\b/;

const exemptions = readExemptions('no-db-params');
const usedExemptions = new Set<string>();
const violations: Violation[] = [];

const functionName = (node: ts.Node, sourceFile: ts.SourceFile): string => {
  const named = node as { name?: ts.Node };
  if (named.name) return named.name.getText(sourceFile);
  const parent = node.parent;
  if (parent && ts.isVariableDeclaration(parent)) return parent.name.getText(sourceFile);
  if (parent && ts.isPropertyAssignment(parent)) return parent.name.getText(sourceFile);
  return '<anonymous>';
};

for (const file of listFiles(['apps', 'packages'], /\.tsx?$/)) {
  if (isTestFile(file) || OUT_OF_SCOPE.test(file) || file.endsWith('.d.ts')) continue;
  const source = readSource(file);
  if (!/\b(db|txn|tx|prisma|Db|PrismaClient|TransactionClient)\b/.test(source)) continue;
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const fileViolations: Violation[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      const type = node.type?.getText(sourceFile) ?? '';
      if (DB_NAMES.has(name) || DB_TYPE.test(type)) {
        const owner = functionName(node.parent, sourceFile);
        fileViolations.push({
          file,
          line: lineAt(source, node.getStart(sourceFile)),
          key: `${owner}(${name})`,
          detail: `${owner} takes a db parameter \`${node.getText(sourceFile)}\``,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (fileViolations.length === 0) continue;
  if (exemptions.has(file)) usedExemptions.add(file);
  else violations.push(...fileViolations);
}

finishFence({
  rule: 'no-db-params',
  violations,
  usedExemptions,
  explain: [
    'Functions that take a db client as a parameter. Use the scoped client instead:',
    "  import { db } from '@template/db';  // resolves to the open db.txn() transaction",
    'Only the db client itself (packages/db) takes a client.',
  ],
  clean: 'No db parameters outside the db client.',
});
