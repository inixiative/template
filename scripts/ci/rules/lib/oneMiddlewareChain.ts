#!/usr/bin/env bun
/**
 * Detector for the one-middleware-chain CI rule. Run from the repo (or fixture) root:
 *   bun scripts/ci/rules/lib/oneMiddlewareChain.ts [--write-baseline]
 *
 * Every router is served from inside the standard chain in apps/api/src/routes/api.ts:
 *   corsMiddleware → prepareRequest → jwtAuthMiddleware → tokenAuthMiddleware → spoofMiddleware
 *   → auditActorMiddleware → apiRateLimit
 * so every route gets the scoped db, a resolved actor, permissions and the rate limit. Fails on
 * - a chain middleware missing from api.ts, or out of order;
 * - a mount (`.route`, `.all`, `.get`, `.doc31`, …, chained or not, or a `.use` on a path whose
 *   handler is written inline) on `apiRouter` before the chain completes;
 * - a mount on `routes` (routes/index.ts) other than `/api`, or on `app` (app.ts) other than `/`;
 * - a mount on `app`, `routes` or `apiRouter` from any other file.
 * Deliberate exceptions are named, one per line with a one-line reason, in
 * scripts/ci/one-middleware-chain/exempt.txt as `<full mount path>\t<reason>`.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  finishFence,
  isTestFile,
  lineAt,
  listFiles,
  ROOT,
  readExemptions,
  readSource,
  type Violation,
} from './fence';

const APP = 'apps/api/src/app.ts';
const ROUTES = 'apps/api/src/routes/index.ts';
const API = 'apps/api/src/routes/api.ts';
const CHAIN = [
  'corsMiddleware',
  'prepareRequest',
  'jwtAuthMiddleware',
  'tokenAuthMiddleware',
  'spoofMiddleware',
  'auditActorMiddleware',
  'apiRateLimit',
];
const ROOTS: Record<string, { file: string; prefix: string }> = {
  app: { file: APP, prefix: '' },
  routes: { file: ROUTES, prefix: '' },
  apiRouter: { file: API, prefix: '/api' },
};
const RECEIVER = /\b(app|routes|apiRouter)\s*(?=\.)/g;
const MOUNT_METHODS = new Set([
  'route',
  'all',
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'on',
  'openapi',
  'mount',
  'doc',
  'doc31',
]);

type Call = { method: string; args: string; offset: number };

const chainedCalls = (text: string, from: number): Call[] => {
  const calls: Call[] = [];
  let i = from;
  for (;;) {
    while (/\s/.test(text[i] ?? '')) i++;
    if (text[i] !== '.') return calls;
    const offset = i;
    i++;
    while (/\s/.test(text[i] ?? '')) i++;
    const name = /^[A-Za-z_$][\w$]*/.exec(text.slice(i))?.[0];
    if (!name) return calls;
    i += name.length;
    while (/\s/.test(text[i] ?? '')) i++;
    if (text[i] !== '(') return calls;
    let depth = 0;
    const argsStart = i + 1;
    for (; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')' && --depth === 0) break;
    }
    calls.push({ method: name, args: text.slice(argsStart, i), offset });
    i++;
  }
};

const literalPath = (args: string): string | undefined =>
  /^\s*(['"`])([^'"`$]*)\1\s*(,|$)/.exec(args)?.[2];

const isMount = (call: Call): boolean => {
  if (MOUNT_METHODS.has(call.method)) return true;
  if (call.method !== 'use') return false;
  const path = literalPath(call.args);
  return path !== '*' && /=>|\bfunction\b/.test(call.args);
};

const exemptions = readExemptions('one-middleware-chain');
const usedExemptions = new Set<string>();
const violations: Violation[] = [];

const code = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, (c) => ' '.repeat(c.length));

const mountsIn = (file: string) => {
  const source = readSource(file);
  const text = code(source);
  return [...text.matchAll(RECEIVER)].flatMap((m) =>
    chainedCalls(text, (m.index ?? 0) + m[0].length)
      .filter(isMount)
      .map((call) => ({
        receiver: m[1],
        method: call.method,
        path: literalPath(call.args),
        offset: call.offset,
        line: lineAt(source, call.offset),
      })),
  );
};

const outside = (file: string, line: number, key: string, detail: string) => {
  if (exemptions.has(key)) usedExemptions.add(key);
  else violations.push({ file, line, key, detail });
};

if (existsSync(join(ROOT, API))) {
  const source = readSource(API);
  const text = code(source);
  let chainEnd = 0;
  let previous = -1;
  for (const name of CHAIN) {
    const use = new RegExp(`\\bapiRouter\\.use\\(\\s*['"]\\*['"]\\s*,\\s*${name}\\s*\\)`).exec(
      text,
    );
    if (!use) {
      violations.push({
        file: API,
        line: 1,
        key: `chain:${name}`,
        detail: `the chain is missing apiRouter.use('*', ${name})`,
      });
      continue;
    }
    if (use.index < previous)
      violations.push({
        file: API,
        line: lineAt(source, use.index),
        key: `chain:${name}`,
        detail: `${name} is out of order; the chain is ${CHAIN.join(' → ')}`,
      });
    previous = use.index;
    chainEnd = Math.max(chainEnd, use.index);
  }

  for (const mount of mountsIn(API)) {
    if (mount.receiver !== 'apiRouter' || mount.offset > chainEnd) continue;
    const path = mount.path === undefined ? '<dynamic>' : `/api${mount.path}`;
    outside(API, mount.line, path, `${path} is mounted before the middleware chain completes`);
  }
}

for (const [receiver, allowed, file] of [
  ['routes', '/api', ROUTES],
  ['app', '/', APP],
] as const) {
  if (!existsSync(join(ROOT, file))) continue;
  for (const mount of mountsIn(file)) {
    if (mount.receiver !== receiver || mount.path === allowed) continue;
    const path = mount.path === undefined ? '<dynamic>' : mount.path;
    outside(file, mount.line, path, `${path} is mounted outside the /api middleware chain`);
  }
}

for (const file of listFiles(['apps/api/src'], /\.tsx?$/)) {
  if (isTestFile(file) || [APP, ROUTES, API].includes(file)) continue;
  for (const mount of mountsIn(file)) {
    const root = ROOTS[mount.receiver];
    const path = `${root.prefix}${mount.path ?? '<dynamic>'}`;
    outside(
      file,
      mount.line,
      path,
      `mounts ${path} on ${mount.receiver} outside ${root.file}; mount it in ${API}, after the chain`,
    );
  }
}

finishFence({
  rule: 'one-middleware-chain',
  violations,
  usedExemptions,
  explain: [
    `Routers served outside the standard middleware chain (${API}):`,
    `  ${CHAIN.join(' → ')}`,
    'Mount routers after apiRateLimit. A deliberate exception is named, with a one-line reason, in',
    'scripts/ci/one-middleware-chain/exempt.txt.',
  ],
  clean: 'Every router is mounted inside the standard middleware chain.',
});
