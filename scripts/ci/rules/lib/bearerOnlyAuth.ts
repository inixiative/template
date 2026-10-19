#!/usr/bin/env bun
/**
 * Detector for the bearer-only-auth CI rule. Run from the repo (or fixture) root:
 *   bun scripts/ci/rules/lib/bearerOnlyAuth.ts [--write-baseline]
 *
 * API auth is bearer-only and session-free: a person presents a JWT, a program an API token, in
 * `Authorization: Bearer`. A cookie or a BetterAuth session never authenticates a request. Sessions
 * exist only inside BetterAuth's own `/api/auth/*` handler for the sign-in handshake (OAuth state, the
 * one-time-token handoff), and jwtHandoff swaps each for a JWT; that is library code, not ours. Each
 * check is one entry in CHECKS, so the rule grows by adding one.
 *
 * Fails, in non-test source under apps/ and packages/, on:
 * - `cookieCache` anywhere (BetterAuth's JWE cookie cache keeps a revoked session alive until it expires)
 * - `credentials` set to `'include'` (also inside a conditional) and `withCredentials` (a client that
 *   sends cookies to the API)
 * - `document.cookie` (auth state lives in the bearer token, never a cookie)
 * - any session lookup: a `getSession(...)` call, `findSession(...)`, or a read of the `session`
 *   table (`<x>.session.find*` / `.count`); a person is resolved from a JWT, never a session
 * - importing BetterAuth's `bearer` plugin (it accepts a session token as a bearer credential)
 * - building a session credential: importing a session-cookie signer (`makeSignature`,
 *   `setRequestCookie`, `setSessionCookie`, `serializeSignedCookie`, `signCookieValue`) from
 *   better-auth or better-call, calling `<x>.internalAdapter.createSession(...)`, or destructuring
 *   `internalAdapter` / `createSession`
 *
 * Exemptions: none in exempt.txt. One named file may build a session credential:
 * `withThrowawaySession` (THROWAWAY_SESSION_HELPER), which hands a short-lived session to a
 * BetterAuth server call and deletes it.
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

const SESSION_TABLE_READS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
]);

const calledName = (node: ts.CallExpression): string | null => {
  if (ts.isPropertyAccessExpression(node.expression)) return node.expression.name.text;
  if (ts.isIdentifier(node.expression)) return node.expression.text;
  return null;
};

const isSessionTableRead = (node: ts.CallExpression): boolean =>
  ts.isPropertyAccessExpression(node.expression) &&
  SESSION_TABLE_READS.has(node.expression.name.text) &&
  ts.isPropertyAccessExpression(node.expression.expression) &&
  node.expression.expression.name.text === 'session';

const sessionLookup: Check = (node) => {
  if (!ts.isCallExpression(node)) return null;
  const name = calledName(node);
  if (name !== 'getSession' && name !== 'findSession' && !isSessionTableRead(node)) return null;
  return {
    node,
    key: `session-lookup: ${name}`,
    detail:
      'a session lookup outside the sign-in handshake; a person is resolved from a JWT (jwtAuthMiddleware)',
  };
};

const bearerPluginImport: Check = (node) =>
  ts.isImportDeclaration(node) &&
  ts.isStringLiteral(node.moduleSpecifier) &&
  node.moduleSpecifier.text.startsWith('better-auth') &&
  node.importClause?.namedBindings &&
  ts.isNamedImports(node.importClause.namedBindings) &&
  node.importClause.namedBindings.elements.some(
    (element) => (element.propertyName ?? element.name).text === 'bearer',
  )
    ? {
        node,
        key: 'better-auth bearer plugin',
        detail:
          "BetterAuth's bearer plugin turns a session token into a credential; persons send JWTs",
      }
    : null;

const THROWAWAY_SESSION_HELPER = 'apps/api/src/lib/auth/withThrowawaySession.ts';

const SESSION_CREDENTIAL_SOURCES = /^(better-auth|better-call)(\/|$)/;
const SESSION_CREDENTIAL_SIGNERS = new Set([
  'makeSignature',
  'setRequestCookie',
  'setSessionCookie',
  'serializeSignedCookie',
  'signCookieValue',
]);
const SESSION_CREATORS = new Set(['internalAdapter', 'createSession']);

const sessionCredential = (node: ts.Node, key: string): Found => ({
  node,
  key: `session-credential: ${key}`,
  detail: `builds a BetterAuth session credential (${key}); only withThrowawaySession may (${THROWAWAY_SESSION_HELPER})`,
});

const sessionCredentialBuild: Check = (node, sourceFile) => {
  if (sourceFile.fileName === THROWAWAY_SESSION_HELPER) return null;
  if (
    ts.isImportDeclaration(node) &&
    ts.isStringLiteral(node.moduleSpecifier) &&
    SESSION_CREDENTIAL_SOURCES.test(node.moduleSpecifier.text) &&
    node.importClause?.namedBindings &&
    ts.isNamedImports(node.importClause.namedBindings)
  ) {
    const signer = node.importClause.namedBindings.elements.find((element) =>
      SESSION_CREDENTIAL_SIGNERS.has((element.propertyName ?? element.name).text),
    );
    return signer ? sessionCredential(node, (signer.propertyName ?? signer.name).text) : null;
  }
  if (
    ts.isPropertyAccessExpression(node) &&
    node.name.text === 'createSession' &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'internalAdapter'
  )
    return sessionCredential(node, 'internalAdapter.createSession');
  if (
    ts.isBindingElement(node) &&
    SESSION_CREATORS.has(unquote((node.propertyName ?? node.name).getText(sourceFile)))
  )
    return sessionCredential(
      node,
      `destructured ${unquote((node.propertyName ?? node.name).getText(sourceFile))}`,
    );
  return null;
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
  sessionLookup,
  bearerPluginImport,
  sessionCredentialBuild,
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
  const visit = (node: ts.Node) => {
    for (const check of CHECKS) {
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
    'API auth is bearer-only and session-free (docs/claude/AUTH.md).',
    '  clients send   Authorization: Bearer <JWT | API token>   (API tokens also as ?token=)',
    '  the server     resolves a person from the JWT (jwtAuthMiddleware); no getSession, no cookieCache',
  ],
  clean: 'No cookie- or session-based API auth.',
});
