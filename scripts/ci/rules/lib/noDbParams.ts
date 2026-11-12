#!/usr/bin/env bun
/**
 * Detector for the no-db-params CI rule. Run from the repo (or fixture) root:
 *   bun scripts/ci/rules/lib/noDbParams.ts [--write-baseline]
 *
 * Services, handlers and helpers use the scoped client (`import { db } from '@template/db'`): it
 * resolves to the open transaction through AsyncLocalStorage, so passing a client by hand is never
 * needed and a passed one can be the wrong one. Fails on a function or method parameter (signatures
 * in types and interfaces included) named `db`/`txn`/`tx`/`prisma` (or `_db`, …), destructuring one
 * of those names, or whose type mentions `Db`, `PrismaClient`, `TransactionClient` or `typeof db`.
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
const DB_NAME = /^_?(db|txn|tx|prisma)$/;
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
  if (!/db|tx|prisma|PrismaClient|TransactionClient/i.test(source)) continue;
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const fileViolations: Violation[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isParameter(node)) {
      const names = ts.isIdentifier(node.name)
        ? [node.name.text]
        : node.name.elements.flatMap((element) =>
            ts.isBindingElement(element) && ts.isIdentifier(element.name)
              ? [element.name.text]
              : [],
          );
      const name = names.find((n) => DB_NAME.test(n)) ?? names.join(',');
      const type = node.type?.getText(sourceFile) ?? '';
      if (names.some((n) => DB_NAME.test(n)) || DB_TYPE.test(type)) {
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
