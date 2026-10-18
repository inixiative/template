#!/usr/bin/env bun
/**
 * Detector for the bearer-only-auth CI rule. Run from the repo (or fixture) root:
 *   bun scripts/ci/rules/lib/bearerOnlyAuth.ts [--write-baseline]
 *
 * API auth is bearer-only: a session token, API token or JWT in `Authorization: Bearer` (or `?token=`).
 * A cookie never authenticates a request that runs through the API middleware chain. BetterAuth's own
 * `/api/auth/*` handler still uses its cookies internally (OAuth state, the one-time-token handoff);
 * that is library code, not ours. Each check is one entry in CHECKS, so the rule grows by adding one.
 *
 * Fails, in non-test source under apps/ and packages/, on:
 * - `cookieCache` anywhere (BetterAuth's JWE cookie cache keeps a revoked session alive until it expires)
 * - `credentials` set to `'include'` (also inside a conditional) and `withCredentials` (a client that
 *   sends cookies to the API)
 * - `document.cookie` (auth state lives in the bearer token, never a cookie)
 * - a `getSession(...)` call whose headers come from the request (`<x>.headers`, `c.req.header()`,
 *   `new Headers(<those>)`, or a local variable holding one) unless that variable had
 *   `.delete('cookie')` called on it earlier in the file; a `getSession` whose headers are built with a
 *   `cookie` (an object key, or `.set`/`.append('cookie', …)` on the variable); and a `getSession`
 *   whose options are not an inline object, since the rule cannot see what it is passed
 *
 * Exemptions: none.
 */
import ts from 'typescript';
import { finishFence, isTestFile, lineAt, listFiles, readSource, type Violation } from './fence';

type Found = { node: ts.Node; key: string; detail: string };
type Check = (node: ts.Node, sourceFile: ts.SourceFile) => Found | null;

const unquote = (text: string): string => text.replace(/^['"`]|['"`]$/g, '');

const propertyName = (node: ts.Node, sourceFile: ts.SourceFile): string | null => {
  if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node))
    return unquote(node.name.getText(sourceFile));
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return null;
};

const containsString = (node: ts.Node, value: string): boolean =>
  (ts.isStringLiteralLike(node) && node.text === value) ||
  (ts.forEachChild(node, (child) => containsString(child, value) || undefined) ?? false);

const isGetSessionCall = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) &&
  ((ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'getSession') ||
    (ts.isIdentifier(node.expression) && node.expression.text === 'getSession'));

const unwrap = (expression: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(expression) ||
  ts.isAsExpression(expression) ||
  ts.isNonNullExpression(expression) ||
  ts.isSatisfiesExpression(expression)
    ? unwrap(expression.expression)
    : expression;

const declarationsOf = (sourceFile: ts.SourceFile): Map<string, ts.Expression> => {
  const out = new Map<string, ts.Expression>();
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      !out.has(node.name.text)
    )
      out.set(node.name.text, node.initializer);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return out;
};

const cookieHeaderCalls = (
  sourceFile: ts.SourceFile,
  methods: string[],
): { name: string; position: number }[] => {
  const out: { name: string; position: number }[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      methods.includes(node.expression.name.text) &&
      ts.isIdentifier(node.expression.expression) &&
      node.arguments.length >= 1 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      node.arguments[0].text.toLowerCase() === 'cookie'
    )
      out.push({ name: node.expression.expression.text, position: node.getStart(sourceFile) });
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return out;
};

const headersArgument = (call: ts.CallExpression, sourceFile: ts.SourceFile) => {
  const [options] = call.arguments;
  if (!options) return { inline: true, headers: null };
  if (!ts.isObjectLiteralExpression(unwrap(options))) return { inline: false, headers: null };
  for (const property of (unwrap(options) as ts.ObjectLiteralExpression).properties) {
    if (ts.isSpreadAssignment(property)) return { inline: false, headers: null };
    if (propertyName(property, sourceFile) !== 'headers') continue;
    if (ts.isPropertyAssignment(property)) return { inline: true, headers: property.initializer };
    if (ts.isShorthandPropertyAssignment(property)) return { inline: true, headers: property.name };
  }
  return { inline: true, headers: null };
};

const fromRequest = (
  expression: ts.Expression,
  declarations: Map<string, ts.Expression>,
  seen = new Set<string>(),
): boolean => {
  const node = unwrap(expression);
  if (ts.isPropertyAccessExpression(node)) return node.name.text === 'headers';
  if (ts.isCallExpression(node))
    return ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'header';
  if (ts.isNewExpression(node))
    return (node.arguments ?? []).some((argument) => fromRequest(argument, declarations, seen));
  if (ts.isIdentifier(node) && !seen.has(node.text)) {
    const initializer = declarations.get(node.text);
    seen.add(node.text);
    return initializer ? fromRequest(initializer, declarations, seen) : false;
  }
  return false;
};

const carriesCookie = (
  expression: ts.Expression,
  declarations: Map<string, ts.Expression>,
  sets: { name: string }[],
  sourceFile: ts.SourceFile,
  seen = new Set<string>(),
): boolean => {
  const node = unwrap(expression);
  if (ts.isObjectLiteralExpression(node))
    return node.properties.some(
      (property) => propertyName(property, sourceFile)?.toLowerCase() === 'cookie',
    );
  if (ts.isNewExpression(node))
    return (node.arguments ?? []).some((argument) =>
      carriesCookie(argument, declarations, sets, sourceFile, seen),
    );
  if (ts.isIdentifier(node) && !seen.has(node.text)) {
    seen.add(node.text);
    if (sets.some((call) => call.name === node.text)) return true;
    const initializer = declarations.get(node.text);
    return initializer ? carriesCookie(initializer, declarations, sets, sourceFile, seen) : false;
  }
  return false;
};

const sessionLookupCheck = (sourceFile: ts.SourceFile): Check => {
  const declarations = declarationsOf(sourceFile);
  const deletes = cookieHeaderCalls(sourceFile, ['delete']);
  const sets = cookieHeaderCalls(sourceFile, ['set', 'append']);
  return (node) => {
    if (!isGetSessionCall(node)) return null;
    const { inline, headers } = headersArgument(node, sourceFile);
    if (!inline)
      return {
        node,
        key: 'getSession-opaque-options',
        detail: 'getSession options must be an inline object so the rule can see its headers',
      };
    if (headers && carriesCookie(headers, declarations, sets, sourceFile))
      return {
        node,
        key: `getSession-cookie-header: ${headers.getText(sourceFile)}`,
        detail: 'getSession resolves a session from a cookie; send the session token as a bearer',
      };
    if (!headers || !fromRequest(headers, declarations)) return null;
    const target = unwrap(headers);
    const stripped =
      ts.isIdentifier(target) &&
      deletes.some((d) => d.name === target.text && d.position < node.getStart(sourceFile));
    if (stripped) return null;
    return {
      node,
      key: `getSession-request-cookie: ${headers.getText(sourceFile)}`,
      detail:
        "getSession resolves a session from request headers that still carry `cookie`; copy them and `.delete('cookie')` first",
    };
  };
};

const CHECKS: Check[] = [
  (node, sourceFile) =>
    propertyName(node, sourceFile) === 'cookieCache'
      ? {
          node,
          key: 'cookie-cache',
          detail: 'BetterAuth cookieCache; sessions are resolved from Redis on every request',
        }
      : null,
  (node, sourceFile) =>
    ts.isPropertyAssignment(node) &&
    propertyName(node, sourceFile) === 'credentials' &&
    containsString(node.initializer, 'include')
      ? {
          node,
          key: "credentials: 'include'",
          detail: "credentials: 'include' sends cookies to the API; send Authorization: Bearer",
        }
      : null,
  (node, sourceFile) =>
    propertyName(node, sourceFile) === 'withCredentials'
      ? {
          node,
          key: 'withCredentials',
          detail: 'withCredentials sends cookies to the API; send Authorization: Bearer',
        }
      : null,
  (node, sourceFile) =>
    ts.isPropertyAccessExpression(node) &&
    node.name.text === 'cookie' &&
    node.expression.getText(sourceFile) === 'document'
      ? {
          node,
          key: 'document.cookie',
          detail: 'document.cookie; auth state is the bearer token, never a cookie',
        }
      : null,
];

const violations: Violation[] = [];

for (const file of listFiles(['apps', 'packages'], /\.tsx?$/)) {
  if (isTestFile(file)) continue;
  const source = readSource(file);
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const checks = [...CHECKS, sessionLookupCheck(sourceFile)];
  const visit = (node: ts.Node) => {
    for (const check of checks) {
      const found = check(node, sourceFile);
      if (found)
        violations.push({
          file,
          line: lineAt(source, found.node.getStart(sourceFile)),
          key: found.key,
          detail: found.detail,
        });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

finishFence({
  rule: 'bearer-only-auth',
  violations,
  explain: [
    'API auth is bearer-only: a cookie never authenticates an API request (docs/claude/AUTH.md).',
    '  clients send   Authorization: Bearer <session token | API token | JWT>   (or ?token= for WebSocket/links)',
    "  the server     copies the request headers and .delete('cookie') before getSession; no cookieCache",
  ],
  clean: 'No cookie-based API auth.',
});
