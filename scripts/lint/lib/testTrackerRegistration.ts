#!/usr/bin/env bun
// Matches registerTestTracker() call expressions, so the name in a comment or string is not a call and a
// call split across lines still is.
import { readFileSync } from 'node:fs';
import ts from 'typescript';

type Violation = { file: string; line: number };

export const findTrackerRegistrations = (
  file: string,
  text: string = readFileSync(file, 'utf8'),
): Violation[] => {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const violations: Violation[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : undefined;
      if (name === 'registerTestTracker') {
        violations.push({
          file,
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return violations;
};

if (import.meta.main) {
  const violations = process.argv.slice(2).flatMap((file) => findTrackerRegistrations(file));

  if (violations.length) {
    process.stdout.write(
      'Found in-file registerTestTracker() calls.\n' +
        'The db client registers the test tracker in every test process; remove the call.\n\n' +
        `${violations.map((v) => `  ${v.file}:${v.line}`).join('\n')}\n`,
    );
    process.exit(1);
  }
}
