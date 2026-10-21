import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findHandCleanup, modelDelegates } from '../lib/testHandCleanup';
import { findTrackerRegistrations } from '../lib/testTrackerRegistration';

let sandbox: string;
let fileCount = 0;

const write = (content: string, name = `case${fileCount++}.test.ts`) => {
  const full = path.join(sandbox, name);
  fs.writeFileSync(full, content);
  return full;
};

const delegates = modelDelegates();

beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'test-cleanup-rules-'));
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

describe('modelDelegates', () => {
  test('reads Prisma model delegates from the schema', () => {
    expect(delegates.has('emailTemplate')).toBe(true);
    expect(delegates.has('organizationUser')).toBe(true);
    expect(delegates.has('cache')).toBe(false);
  });
});

describe('findHandCleanup', () => {
  test('follows a helper imported through a tsconfig path alias', () => {
    fs.mkdirSync(path.join(sandbox, 'test'));
    fs.writeFileSync(
      path.join(sandbox, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@helpers/*': ['test/*'] } } }),
    );
    write(
      'export const clearRows = async () => {\n  await db.emailTemplate.deleteMany({});\n};\n',
      'test/clearRows.ts',
    );
    const file = write(
      "import { clearRows } from '@helpers/clearRows';\n\nbeforeEach(async () => {\n  await clearRows();\n});\n",
    );
    expect(findHandCleanup(file, delegates)).toHaveLength(1);
  });

  test('does not follow into production code', () => {
    fs.mkdirSync(path.join(sandbox, 'hooks'));
    write(
      "export const registerHook = () => {\n  registerDbHook('x', 'EmailTemplate', 'after', ['delete'], async () => {\n    await db.emailTemplate.deleteMany({});\n  });\n};\n",
      'hooks/registerHook.ts',
    );
    const file = write(
      "import { registerHook } from './hooks/registerHook';\n\nbeforeEach(() => {\n  registerHook();\n});\n",
    );
    expect(findHandCleanup(file, delegates)).toEqual([]);
  });

  test('ignores a delete that only appears in a comment', () => {
    const file = write(
      'afterEach(async () => {\n  // await db.emailTemplate.deleteMany({});\n  /* db.organizationUser.delete() */\n  await cleanupTouchedTables();\n});\n',
    );
    expect(findHandCleanup(file, delegates)).toEqual([]);
  });

  test('ignores a delete on something that is not a model delegate', () => {
    const file = write('afterEach(() => {\n  seen.delete(key);\n  ctx.cache.delete(key);\n});\n');
    expect(findHandCleanup(file, delegates)).toEqual([]);
  });

  test('flags a model delete on any client, including db.raw and a transaction', () => {
    const file = write(
      'afterEach(async () => { await db.raw.emailTemplate.deleteMany({}); });\nafterAll(async () => { await tx.organizationUser.delete({ where: { uuid } }); });\n',
    );
    expect(findHandCleanup(file, delegates).map((v) => v.line)).toEqual([1, 2]);
  });

  test('flags a raw-SQL delete in a tagged template', () => {
    const file = write(
      'afterEach(async () => {\n  await db.$executeRaw`DELETE FROM "EmailTemplate"`;\n});\n',
    );
    expect(findHandCleanup(file, delegates)).toHaveLength(1);
  });

  test('points at the helper when the delete lives outside the hook', () => {
    const file = write(
      'const clear = async () => {\n  await db.emailTemplate.deleteMany({});\n};\n\nafterEach(clear);\n',
    );
    const [violation] = findHandCleanup(file, delegates);
    expect(violation?.line).toBe(5);
    expect(violation?.via).toBe(`${file}:2`);
  });
});

describe('findTrackerRegistrations', () => {
  test('ignores the name in comments and strings', () => {
    const file = write(
      "// registerTestTracker();\n/* registerTestTracker() is automatic */\nconst s = 'registerTestTracker()';\n",
    );
    expect(findTrackerRegistrations(file)).toEqual([]);
  });

  test('flags a call split across lines and a call through a namespace', () => {
    const file = write('registerTestTracker\n  ();\ntracker.registerTestTracker();\n');
    expect(findTrackerRegistrations(file).map((v) => v.line)).toEqual([1, 3]);
  });
});
